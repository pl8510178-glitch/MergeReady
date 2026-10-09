"""MergeReady command line: fetch history, rehearse a diff, or replay held-out PRs."""
import argparse
import json
from pathlib import Path
from fetch import fetch_repo
from predict import predict
from retrieve import find_similar
from store import load_all

def command_fetch(args):
    prs = fetch_repo(args.repo, args.limit)
    print(f"Saved {len(prs)} PRs for {args.repo}.")

def command_rehearse(args):
    diff = Path(args.diff_file).read_text(encoding="utf-8") if args.diff_file else ""
    files = [line[6:].strip() for line in diff.splitlines() if line.startswith("File: ")]
    query = f"Title: {args.title}\nDescription: {args.description}\nChanged files: {', '.join(files)}\nDiff:\n{diff}"
    examples = find_similar(args.repo, args.title, args.description, files, diff)
    result = predict(query, examples)
    print(json.dumps({"repo": args.repo, "evidence_prs": [p["number"] for p in examples], **result}, indent=2))
    Path("outputs").mkdir(exist_ok=True)
    Path("outputs/latest_prediction.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

def command_evaluate(args):
    prs = load_all(args.repo)
    eligible = [p for p in prs if p["comments"] and p["files"]]
    holdout = eligible[-args.holdout:]
    rows = []
    for test in holdout:
        examples = find_similar(args.repo, test["title"], test["body"], test["files"],
                                before=test["created_at"], exclude=test["number"])
        if not examples:
            rows.append({"pr": test["number"], "status": "no earlier evidence"})
            continue
        query = f"Title: {test['title']}\nDescription: {test['body']}\nChanged files: {', '.join(test['files'])}"
        result = predict(query, examples)
        rows.append({"pr": test["number"], "actual_comments": len(test["comments"]),
                     "evidence_prs": [p["number"] for p in examples], **result})
        print(f"Replayed PR #{test['number']}: {len(result['predictions'])} supported predictions")
    Path("outputs").mkdir(exist_ok=True)
    Path("outputs/replay.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"Saved chronological replay results for {len(rows)} held-out PRs to outputs/replay.json")
    print("This first version saves predictions for transparent manual scoring; it does not claim an automatic accuracy score.")

def main():
    parser = argparse.ArgumentParser(description="Learn review patterns from public GitHub PR history.")
    sub = parser.add_subparsers(required=True)
    f = sub.add_parser("fetch", help="Fetch merged PR history into SQLite")
    f.add_argument("repo", help="owner/name, for example pallets/flask")
    f.add_argument("--limit", type=int, default=30)
    f.set_defaults(func=command_fetch)
    r = sub.add_parser("rehearse", help="Review a diff using earlier similar PRs")
    r.add_argument("--repo", required=True)
    r.add_argument("--title", default="New change")
    r.add_argument("--description", default="")
    r.add_argument("--diff-file", default="")
    r.set_defaults(func=command_rehearse)
    e = sub.add_parser("evaluate", help="Replay the newest PRs using only older history")
    e.add_argument("--repo", required=True)
    e.add_argument("--holdout", type=int, default=5)
    e.set_defaults(func=command_evaluate)
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()

