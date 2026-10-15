
from app.claim_extraction_service import extract_claims


def match_claims_to_sources(
    answer: str,
    sources: list[dict],
) -> dict:
    """
    Match citation-linked claims to retrieved source passages.

    Expected source format:
    {
        "citation": "[1]",
        "text": "Source passage..."
    }
    """

    if not isinstance(sources, list):
        raise ValueError("Sources must be a list.")

    for index, source in enumerate(sources, start=1):
        if not isinstance(source, dict):
            raise ValueError(
                f"Source {index} must be a dictionary."
            )

        if not isinstance(source.get("citation"), str):
            raise ValueError(
                f"Source {index} needs a citation string."
            )

        if not isinstance(source.get("text"), str):
            raise ValueError(
                f"Source {index} needs a text string."
            )

    claims = extract_claims(answer)

    source_lookup = {
        source["citation"]: source["text"]
        for source in sources
    }

    matched = []
    unmatched = []

    for item in claims:
        citation = item["citation"]
        evidence = source_lookup.get(citation)

        if evidence is None or not evidence.strip():
            unmatched.append(item)
            continue

        matched.append(
            {
                "claim": item["claim"],
                "citation": citation,
                "evidence": evidence,
            }
        )

    return {
        "total_extracted_claims": len(claims),
        "matched_claims": matched,
        "unmatched_claims": unmatched,
        "matched_count": len(matched),
        "unmatched_count": len(unmatched),
    }
