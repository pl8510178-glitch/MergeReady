"""Fetch a small, public GitHub PR review corpus into SQLite."""
import os
import time
import requests
from dotenv import load_dotenv
from store import save_many

load_dotenv()
API = "https://api.github.com"

def get_json(url, params=None):
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.get(url, headers=headers, params=params, timeout=30)
    if response.status_code == 403 and response.headers.get("X-RateLimit-Remaining") == "0":
        raise RuntimeError("GitHub API rate limit reached. Add a read-only GITHUB_TOKEN to .env and retry.")
    response.raise_for_status()
    return response.json()

def fetch_repo(repo, limit=30):
    owner, name = repo.split("/", 1)
    pulls = get_json(f"{API}/repos/{owner}/{name}/pulls",
                     {"state": "closed", "sort": "created", "direction": "desc", "per_page": min(limit * 3, 100)})
    merged = [p for p in pulls if p.get("merged_at")][:limit]
    results = []
    for index, p in enumerate(merged, 1):
        number = p["number"]
        base = f"{API}/repos/{owner}/{name}"
        files = get_json(f"{base}/pulls/{number}/files", {"per_page": 100})
        inline = get_json(f"{base}/pulls/{number}/comments", {"per_page": 100})
        reviews = get_json(f"{base}/pulls/{number}/reviews", {"per_page": 100})
        comments = []
        for c in inline:
            if c.get("body", "").strip():
                comments.append({"author": c.get("user", {}).get("login", ""),
                                 "path": c.get("path", ""), "line": c.get("line") or c.get("original_line"),
                                 "body": c["body"], "kind": "inline"})
        for c in reviews:
            body = (c.get("body") or "").strip()
            author = c.get("user", {}).get("login", "")
            if body and author != p.get("user", {}).get("login"):
                comments.append({"author": author, "path": "", "line": None, "body": body, "kind": "review"})
        results.append({
            "number": number, "title": p.get("title", ""), "body": p.get("body") or "",
            "created_at": p.get("created_at", ""), "merged_at": p.get("merged_at", ""),
            "url": p.get("html_url", ""), "files": [f["filename"] for f in files],
            "comments": comments,
        })
        print(f"[{index}/{len(merged)}] PR #{number}: {len(files)} files, {len(comments)} review comments")
        time.sleep(0.15)
    save_many(repo, results)
    return results

