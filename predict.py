"""Qwen selects relevant historical review signals; every output is evidence-verified."""
import os
import re
import requests
from dotenv import load_dotenv
from verify import verify

load_dotenv()
BASE = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1").rstrip("/")

def offline_predict(query, examples):
    if not examples:
        return {"mode": "offline_evidence", "predictions": [], "rejected": [],
                "message": "No similar reviewed PRs found; staying silent."}
    words = set((query or "").lower().split())
    ranked = []
    seen = set()
    for pr in examples:
        for comment in pr.get("comments", []):
            body = " ".join((comment.get("body") or "").split())
            if len(body) < 30 or body.lower() in seen:
                continue
            seen.add(body.lower())
            overlap = sum(1 for word in set(body.lower().split()) if len(word) > 4 and word in words)
            ranked.append({"concern": body[:240], "file": comment.get("path") or "",
                           "evidence_pr": pr.get("number"), "confidence": "low",
                           "suggested_fix": "Check whether this historical concern applies to your change.",
                           "_rank": overlap})
    ranked.sort(key=lambda item: item["_rank"], reverse=True)
    predictions = ranked[:5]
    for item in predictions:
        item.pop("_rank", None)
    accepted, rejected = verify(predictions, examples)
    return {"mode": "offline_evidence", "predictions": accepted, "rejected": rejected,
            "message": "Offline evidence mode: these are retrieved historical comments, not model-generated predictions."}

def predict(query, examples, model=None):
    """Use Qwen to select applicable evidence; fall back to lexical retrieval if unavailable."""
    if not examples:
        return offline_predict(query, examples)
    evidence = []
    for pr in examples:
        for comment in pr.get("comments", [])[:5]:
            body = " ".join((comment.get("body") or "").split())
            if len(body) >= 30:
                evidence.append({"pr": pr.get("number"), "file": comment.get("path") or "", "comment": body[:300]})
    evidence = evidence[:12]
    if not evidence:
        return offline_predict(query, examples)
    try:
        if not model:
            response = requests.get(f"{BASE}/models", timeout=4)
            response.raise_for_status()
            models = response.json().get("data", [])
            if not models:
                raise RuntimeError("No model is loaded in the local API")
            model = models[0]["id"]
        choices = "\n".join(f"{i}. PR #{item['pr']} | {item['file']} | {item['comment']}" for i, item in enumerate(evidence, 1))
        prompt = ("Review change:\n" + (query or "")[:2200] + "\n\nHistorical review comments:\n" + choices +
                  "\n\nChoose up to 3 numbered comments that are relevant to the change. Return ONLY their numbers separated by commas, or NONE. Do not invent concerns.")
        response = requests.post(f"{BASE}/chat/completions", json={
            "model": model, "messages": [
                {"role": "system", "content": "Select only from numbered historical review comments. Output only selected numbers separated by commas, or NONE."},
                {"role": "user", "content": prompt}],
            "temperature": 0, "max_tokens": 40, "reasoning_effort": "none"
        }, timeout=90)
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        # Parse IDs only from the first line, so prose cannot invent PR evidence.
        ids = []
        for value in re.findall(r"\d+", answer.splitlines()[0][:100]):
            number = int(value)
            if 1 <= number <= len(evidence) and number not in ids:
                ids.append(number)
        predictions = []
        for number in ids[:3]:
            item = evidence[number - 1]
            predictions.append({"concern": item["comment"][:240], "file": item["file"],
                                "evidence_pr": item["pr"], "confidence": "low",
                                "suggested_fix": "Check whether this cited historical concern applies to your change."})
        accepted, rejected = verify(predictions, examples)
        if not accepted and examples and not predictions:
            return {"mode": "local_model", "model": model, "predictions": [], "rejected": rejected,
                    "message": "Qwen selected no historical concerns for this change."}
        return {"mode": "local_model", "model": model, "predictions": accepted, "rejected": rejected}
    except Exception as exc:
        result = offline_predict(query, examples)
        result["model_note"] = f"Local Qwen unavailable; used offline evidence instead ({type(exc).__name__})."
        return result
