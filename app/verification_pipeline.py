
from app.evidence_matching_service import match_claims_to_sources
from app.claim_verification_service import verify_claims


def run_verification_pipeline(
    answer: str,
    sources: list[dict],
) -> dict:
    """
    Run the experimental evidence-verification pipeline.

    1. Extract citation-linked claims.
    2. Match claims to their cited source passages.
    3. Use the NLI model to classify each matched claim.

    Predictions are not definitive factual judgments.
    """

    # Step 1: Extract claims and match them to evidence.
    matching = match_claims_to_sources(
        answer=answer,
        sources=sources,
    )

    # Step 2: Classify each matched claim using DeBERTa.
    verification = verify_claims(
        claims=matching["matched_claims"]
    )

    # Step 3: Build the verification report.
    return {
        "verification_type": "experimental_nli",
        "total_extracted_claims": matching[
            "total_extracted_claims"
        ],
        "matched_count": matching["matched_count"],
        "unmatched_count": matching["unmatched_count"],
        "unmatched_claims": matching["unmatched_claims"],
        "verified_claims": verification["results"],
        "prediction_counts": verification[
            "prediction_counts"
        ],
    }
