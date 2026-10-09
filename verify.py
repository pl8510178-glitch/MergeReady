"""Evidence-or-silence: discard predictions citing PRs outside retrieved evidence."""
def verify(predictions, examples):
    allowed = {str(pr["number"]) for pr in examples}
    accepted, rejected = [], []
    for item in predictions:
        cited = str(item.get("evidence_pr", "")).lstrip("#")
        if cited in allowed and item.get("concern"):
            accepted.append(item)
        else:
            rejected.append(item)
    return accepted, rejected

