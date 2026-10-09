# MergeReady

MergeReady is a contributor-side pull request rehearsal tool. It learns from public pull request reviews, retrieves similar historical comments, and uses a local open-weight Qwen model to select which past concerns deserve attention for a new change. Every displayed concern links to a real evidence PR and is checked by a verifier.

## What is original here

- **Contributor-side rehearsal:** surfaces likely review concerns before a PR is submitted.
- **Evidence-only model output:** Qwen selects from retrieved historical review comments; it cannot cite a PR outside the retrieved evidence. If local inference is unavailable, a transparent lexical retrieval fallback runs instead.
- **Chronological replay:** hides later PRs from earlier evidence and saves predictions for manual review. The current replay is a small prototype, not a validated accuracy claim.

## Run on Windows

Requirements: Python 3.11+ and Bionic with a downloaded Qwen model. The tested model identifier is `qwen3.5-0.8b`.

1. Create the environment and install Python packages in the project folder:

       py -3 -m venv .venv
       .\.venv\Scripts\python.exe -m pip install -r requirements.txt

2. Load Qwen in Bionic. Enable **Settings → Local Model API**, or start the local server from PowerShell:

       lms server start --port 1234

The app connects to `http://localhost:1234/v1`. To override it, set `LM_STUDIO_BASE_URL` in a local `.env` file. Keep the API bound to localhost.

3. Fetch some public PR history (GitHub may rate-limit unauthenticated requests; if that happens, add a read-only public-repository token to a local `.env` file as `GITHUB_TOKEN=your_token`; never commit `.env`):

       .\.venv\Scripts\python.exe app.py fetch pallets/flask --limit 10

4. Rehearse a change with Qwen:

       .\.venv\Scripts\python.exe app.py rehearse --repo pallets/flask --title "Improve request handling" --description "Add tests for request validation and handling"

5. Replay held-out PRs using only older evidence:

       .\.venv\Scripts\python.exe app.py evaluate --repo pallets/flask --holdout 5

Results are saved under `outputs/`. Inspect `outputs/replay.json` and confirm each citation before presenting. Small repositories or a small fetched sample may produce very limited evaluation results; do not present the heuristic/manual replay as a verified accuracy score.

## Privacy and limitations

Inference runs locally through Bionic. The CLI sends the change and retrieved public review examples to the local API on your machine. `.env`, the local SQLite database, and `outputs/` are excluded from Git. A local GitHub token is optional and must never be committed.
