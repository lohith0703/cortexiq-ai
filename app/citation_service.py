
import re


# Match numbered citations such as [1], [2], [15].
CITATION_PATTERN = re.compile(r"\[(\d+)\]")


def validate_citations(
    answer: str,
    sources: list[dict],
) -> dict:
    """
    Check whether citations in an LLM-generated answer
    refer to sources that were actually retrieved.

    This validates citation references, not whether
    the cited evidence supports every claim.
    """

    if not isinstance(answer, str):
        raise ValueError("Answer must be a string.")

    if not isinstance(sources, list):
        raise ValueError("Sources must be a list.")

    # Extract citation numbers from the answer.
    cited_numbers = [
        int(number)
        for number in CITATION_PATTERN.findall(answer)
    ]

    # Remove duplicates while preserving order.
    unique_citations = list(dict.fromkeys(cited_numbers))

    # Build the set of available source citations.
    available_citations = set()

    for source in sources:
        citation = source.get("citation", "")

        match = CITATION_PATTERN.fullmatch(citation)

        if match:
            available_citations.add(int(match.group(1)))

    # Identify valid and invalid references.
    valid_citations = [
        f"[{number}]"
        for number in unique_citations
        if number in available_citations
    ]

    invalid_citations = [
        f"[{number}]"
        for number in unique_citations
        if number not in available_citations
    ]

    # Sources that were retrieved but never cited.
    unused_citations = [
        f"[{number}]"
        for number in sorted(available_citations)
        if number not in unique_citations
    ]

    has_citations = len(unique_citations) > 0

    references_valid = (
        has_citations
        and len(invalid_citations) == 0
    )

    return {
        "has_citations": has_citations,
        "references_valid": references_valid,
        "valid_citations": valid_citations,
        "invalid_citations": invalid_citations,
        "unused_citations": unused_citations,
        "citation_count": len(unique_citations),
        "validation_type": "reference_integrity",
    }
