"""Small loopback-only HTTP bridge from the MergeReady web demo to the Qwen predictor."""
import json
import os
import requests
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from retrieve import find_similar
from predict import predict
from store import load_all

HOST = "127.0.0.1"
PORT = 8000

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5174")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/api/health":
            return self.send_json(404, {"error": "Not found"})
        base = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1").rstrip("/")
        try:
            models = requests.get(base + "/models", timeout=3).json().get("data", [])
            self.send_json(200, {"ok": bool(models), "model": models[0]["id"] if models else None})
        except Exception:
            self.send_json(200, {"ok": False, "model": None})

    def do_POST(self):
        if self.path != "/api/review":
            return self.send_json(404, {"error": "Not found"})
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            repo = str(payload.get("repo", "")).strip()
            if "/" not in repo:
                return self.send_json(400, {"error": "Repository must look like owner/name"})
            title = str(payload.get("title", "Review this change")).strip()[:200]
            description = str(payload.get("description", "")).strip()[:2000]
            code = str(payload.get("code", "")).strip()[:12000]
            path = str(payload.get("filePath", "")).strip()[:300]
            if not code:
                return self.send_json(400, {"error": "Paste code or a diff first"})
            files = [path] if path else [line[6:].strip() for line in code.splitlines() if line.startswith("File: ")]
            query = f"Title: {title}\nDescription: {description}\nChanged files: {', '.join(files)}\nCode or diff:\n{code}"
            examples = find_similar(repo, title, description, files, code, limit=5)
            result = predict(query, examples)
            result["repo"] = repo
            result["history_prs"] = len(load_all(repo))
            for item in result.get("predictions", []):
                item["evidence_url"] = f"https://github.com/{repo}/pull/{item['evidence_pr']}"
            result["related_prs"] = [
                {"number": pr["number"], "title": pr["title"],
                 "url": pr.get("url") or f"https://github.com/{repo}/pull/{pr['number']}",
                 "files": pr["files"][:3], "review_count": len(pr["comments"])}
                for pr in examples
            ]
            self.send_json(200, result)
        except Exception as exc:
            self.send_json(500, {"error": f"Review failed: {type(exc).__name__}: {exc}"})

    def log_message(self, format, *args):
        print("[MergeReady API] " + (format % args))

if __name__ == "__main__":
    print(f"MergeReady API listening at http://{HOST}:{PORT}")
    print("Keep this terminal open while using the browser demo.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()