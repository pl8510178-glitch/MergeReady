"""SQLite storage for MergeReady's public pull-request review corpus."""
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "mergeready.sqlite3"

def connect(path=DB_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS pull_requests (
        repo TEXT NOT NULL, number INTEGER NOT NULL, title TEXT, body TEXT,
        created_at TEXT, merged_at TEXT, url TEXT, files_json TEXT, comments_json TEXT,
        PRIMARY KEY (repo, number)
    )""")
    return db

def save_many(repo, prs, path=DB_PATH):
    with connect(path) as db:
        for pr in prs:
            db.execute("""INSERT OR REPLACE INTO pull_requests
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (repo, pr["number"], pr.get("title", ""), pr.get("body", ""),
                 pr.get("created_at", ""), pr.get("merged_at", ""), pr.get("url", ""),
                 json.dumps(pr.get("files", [])), json.dumps(pr.get("comments", []))))
        db.commit()

def load_all(repo, path=DB_PATH):
    with connect(path) as db:
        rows = db.execute("SELECT * FROM pull_requests WHERE repo=? ORDER BY created_at ASC", (repo,)).fetchall()
    return [dict(row) | {"files": json.loads(row["files_json"]), "comments": json.loads(row["comments_json"])} for row in rows]

