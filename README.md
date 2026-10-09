# MergeReady

A contributor-side pull request rehearsal tool. It retrieves similar past reviews, asks a local open-weight model for likely concerns, and drops any prediction whose cited example PR is not in the retrieved evidence.

## Current prototype

This first version is a command-line research prototype. It fetches public merged PRs, stores them in SQLite, ranks historical examples using changed-path and text overlap, queries a local LM Studio/Bionic-compatible API, verifies evidence PR numbers, and saves replay output. It deliberately does not claim an automatic accuracy score; held-out predictions are saved for review.

Model for the demo: **Qwen3 4B, 4-bit quantization** (or a smaller Qwen model if the laptop cannot load it).

## Setup

1. Install Python 3.11 or newer.
2. In Bionic, download a local Qwen model, load it in a session, then enable **Settings → Local Model API**. The local API is expected at `http://localhost:1234/v1`.
3. Open a terminal in this folder and run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

4. Optional: create a GitHub fine-grained token with read access and place it in a local `.env` file:

```text
GITHUB_TOKEN=put_your_token_here
```

Never commit `.env`. Public repositories can be fetched without a token, but unauthenticated requests have lower limits.

## Run

Fetch 30 recent merged pull requests (this may use several GitHub API calls per PR):

```powershell
python app.py fetch pallets/flask --limit 30
```

Rehearse a diff saved as a text file. Put changed file paths on lines beginning with `File: `.

```powershell
python app.py rehearse --repo pallets/flask --title "Handle empty booking response" --diff-file sample.diff
```

Replay the newest five PRs. Each test PR is excluded from its own evidence set, and only PRs created earlier are retrieved:

```powershell
python app.py evaluate --repo pallets/flask --holdout 5
```

Results are written to `outputs/latest_prediction.json` and `outputs/replay.json`. Check every prediction's linked PR before presenting it. The replay file is not an accuracy score; manually compare predictions with the hidden review comments before reporting precision or recall.

## Data and privacy

Only public GitHub PR history is fetched. Model inference is local when using Bionic's local model API. The SQLite database and output files stay on your machine and are ignored by Git.

