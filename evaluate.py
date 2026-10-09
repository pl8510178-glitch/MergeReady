"""Chronological replay evaluation with transparent text-overlap matching.
Treat the overlap score as a screening aid and manually inspect saved matches.
"""
import json
import re
from pathlib import Path
from predict import predict
from retrieve import find_similar
from store import load_all

STOP = {"the","and","for","with","from","this","that","into","when","then","are","was","will","have","has","not"}

def words(text):
    return {w for w in re.findall(r"[a-z0-9_]{3,}", (text or "").lower()) if w not in STOP}

def run(repo, holdout=5):
    prs = [p for p in load_all(repo) if p["comments"] and p["files"]]
    results = []
    tp = predicted = actual = 0
    for test in prs[-holdout:]:
        examples = find_similar(repo, test["title"], test["body"], test["files"],
                                before=test["created_at"], exclude=test["number"])
        query = f"Title: {test['title']}\nDescription: {test['body']}\nChanged files: {', '.join(test['files'])}"
        result = predict(query, examples) if examples else {"predictions": [], "rejected": []}
        actual_comments = [c["body"] for c in test["comments"]]
        matched = []
        for item in result["predictions"]:
            pwords = words(item.get("concern", "") + " " + item.get("suggested_fix", ""))
            overlap = max((len(pwords & words(text)) / max(1, len(pwords | words(text))) for text in actual_comments), default=0)
            matched.append({"prediction": item, "best_text_overlap": round(overlap, 3), "heuristic_match": overlap >= 0.15})
        tp += sum(m["heuristic_match"] for m in matched)
        predicted += len(matched)
        actual += len(actual_comments)
        results.append({"test_pr": test["number"], "created_at": test["created_at"],
                        "training_evidence_prs": [p["number"] for p in examples],
                        "actual_comments": actual_comments, "comparisons": matched,
                        "unsupported_predictions": result.get("rejected", [])})
    report = {"repo": repo, "held_out_prs": len(results),
              "heuristic_precision": round(tp / max(1, predicted), 3),
              "comment_recall_proxy": round(tp / max(1, actual), 3),
              "note": "Text-overlap estimates are not ground truth. Manually inspect every match before presenting a score.",
              "results": results}
    Path("outputs").mkdir(exist_ok=True)
    Path("outputs/replay.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("repo", "held_out_prs", "heuristic_precision", "comment_recall_proxy", "note")}, indent=2))
    print("Detailed comparisons saved to outputs/replay.json")
    return report

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("repo", help="owner/name")
    parser.add_argument("--holdout", type=int, default=5)
    args = parser.parse_args()
    run(args.repo, args.holdout)

