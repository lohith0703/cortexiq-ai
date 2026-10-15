
from app.evidence_service import verify_evidence


def verify_claims(claims: list[dict]) -> dict:
    """
    Evaluate individual claims against their evidence.

    Each item must contain:
        claim: factual statement to evaluate
        evidence: supporting passage
        citation: source reference
    """

    if not isinstance(claims, list):
        raise ValueError("Claims must be a list.")

    results = []

    for index, item in enumerate(claims, start=1):

        if not isinstance(item, dict):
            raise ValueError(
                f"Claim item {index} must be a dictionary."
            )

        claim = item.get("claim")
        evidence = item.get("evidence")
        citation = item.get("citation")

        if not isinstance(citation, str) or not citation.strip():
            raise ValueError(
                f"Claim item {index} needs a citation."
            )

        verification = verify_evidence(
            evidence=evidence,
            claim=claim,
        )

        results.append(
            {
                "claim": claim,
                "citation": citation,
                "prediction": verification["prediction"],
                "scores": verification["scores"],
                "model": verification["model"],
            }
        )

    counts = {
        "entailment": 0,
        "contradiction": 0,
        "neutral": 0,
    }

    for result in results:
        counts[result["prediction"]] += 1

    return {
        "total_claims": len(results),
        "results": results,
        "prediction_counts": counts,
        "verification_type": "experimental_nli",
    }
