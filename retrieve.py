"""Transparent lexical retrieval: changed-path overlap plus title/body token overlap."""
import re
from store import load_all

STOP = {"the","and","for","with","from","this","that","into","when","then","are","was","will","have","has","not","but","use","new","fix","add"}

def tokens(text):
    return {w for w in re.findall(r"[a-z0-9_]{3,}", (text or "").lower()) if w not in STOP}

def jaccard(a, b):
    return len(a & b) / max(1, len(a | b))

def find_similar(repo, title="", description="", files=None, diff="", before=None, exclude=None, limit=5):
    files = set(files or [])
    words = tokens(" ".join([title, description, diff]))
    results = []
    for pr in load_all(repo):
        if exclude is not None and int(pr["number"]) == int(exclude):
            continue
        if before and pr["created_at"] >= before:
            continue
        if not pr["comments"]:
            continue
        old_files = set(pr["files"])
        file_score = len(files & old_files) / max(1, len(files | old_files))
        text_score = jaccard(words, tokens(pr["title"] + " " + pr["body"]))
        score = 0.65 * file_score + 0.35 * text_score
        if score > 0:
            results.append((score, pr))
    results.sort(key=lambda pair: pair[0], reverse=True)
    return [{"score": round(score, 3), **pr} for score, pr in results[:limit]]

