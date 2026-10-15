
import re


CITATION_PATTERN = re.compile(r"\[(\d+)\]")

BULLET_PATTERN = re.compile(
    r"^\s*(?:[-*•]|\d+[.)])\s+"
)

SOURCE_HEADING_PATTERN = re.compile(
    r"^\s*(?:sources?|references?|"
    r"these technologies are cited from "
    r"the following passages.*):?\s*$",
    re.IGNORECASE,
)


def normalize_claim(text: str) -> str:
    """
    Remove citation markers and normalize whitespace.
    """
    text = CITATION_PATTERN.sub("", text)

    text = re.sub(r"\s+", " ", text)

    text = re.sub(
        r"\s+([.,!?;:])",
        r"\1",
        text,
    )

    return text.strip()


def extract_claims(answer: str) -> list[dict]:
    """
    Extract citation-linked claims from AI answers.

    Supports:
    - Normal sentences
    - Markdown bullet lists
    - Numbered lists
    - Multiple citations per statement

    Limitations:
    - Does not split compound statements into atomic facts.
    - Does not independently verify citation relevance.
    - Does not yet return uncited claims.
    """

    if not isinstance(answer, str):
        raise ValueError("Answer must be a string.")

    if not answer.strip():
        return []

    claims = []
    seen = set()

    lines = answer.splitlines()

    # Skip clearly marked source/reference sections.
    in_source_section = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        if SOURCE_HEADING_PATTERN.match(stripped):
            in_source_section = True
            continue

        if in_source_section:
            continue

        # Handle bullet and numbered list items.
        if BULLET_PATTERN.match(stripped):
            stripped = BULLET_PATTERN.sub("", stripped)

        # Split ordinary sentences while preserving
        # citation markers in each sentence.
        sentences = re.split(
            r"(?<=[.!?])\s+",
            stripped,
        )

        for sentence in sentences:
            citations = CITATION_PATTERN.findall(sentence)

            if not citations:
                continue

            claim_text = normalize_claim(sentence)

            if not claim_text:
                continue

            for number in dict.fromkeys(citations):
                citation = f"[{number}]"

                key = (claim_text, citation)

                if key in seen:
                    continue

                seen.add(key)

                claims.append(
                    {
                        "claim": claim_text,
                        "citation": citation,
                    }
                )

    return claims
