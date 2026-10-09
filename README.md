# MergeReady

MergeReady is a contributor-side pull request rehearsal tool. Paste a code change, and Qwen selects relevant comments from similar past reviews in the repository. MergeReady verifies that every displayed concern cites a retrieved historical PR.

## What the demo does

1. Retrieves similar reviewed PRs from a local SQLite history using file-path and text overlap.
2. Sends the proposed change and retrieved review comments to a local open-weight Qwen model.
3. Qwen selects relevant past comments; an evidence verifier rejects citations outside the retrieved PRs.
4. Displays each concern with the source PR link.

Qwen is doing the relevance selection. If the local model is unavailable, the interface labels the result as an evidence-only fallback. The project also supports chronological replay for manual evaluation; it does not claim a verified accuracy score.

## Run the browser demo on Windows

Requirements: Python 3.11+, Node.js, Bionic with a downloaded Qwen model, and the PR history database.

Install Python dependencies once:

    py -3 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    npm install

In Bionic, load Qwen and start the local API:

    lms server start --port 1234

Keep that terminal open. In a second VS Code terminal, start the MergeReady API:

    .\.venv\Scripts\python.exe web_api.py

Keep it open. In a third terminal, start the browser interface:

    npm run dev -- --port 5174

Open http://127.0.0.1:5174, choose Load working sample, and click Review my change with Qwen. Or replace the sample with your own repository, file path, title, description, and code or diff.

## Fetch repository history

The browser demo uses local history. Fetch public PR history once:

    .\.venv\Scripts\python.exe app.py fetch pallets/flask --limit 10

GitHub may rate-limit unauthenticated requests. If needed, add a read-only public-repository token to a local .env file as GITHUB_TOKEN=your_token. Never commit .env.

## Replay evaluation

Replay eligible historical PRs while retrieving evidence only from earlier PRs:

    .\.venv\Scripts\python.exe app.py evaluate --repo pallets/flask --holdout 5

Results are saved to outputs/replay.json. The current sample is small; manually inspect predictions and citations. Do not present the replay as a validated accuracy benchmark.

## Privacy and limitations

Inference is local through Bionic at http://localhost:1234/v1. The browser talks to a local Python API bound to 127.0.0.1; source code is not sent to GitHub or a hosted model. MergeReady does not write to GitHub. .env, the local SQLite database, and generated outputs/ are excluded from Git.
