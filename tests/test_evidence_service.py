
from unittest.mock import patch

import pytest

from app.evidence_service import verify_evidence


@pytest.mark.parametrize(
    "evidence, claim",
    [
        (
            "Jahnavi knows PostgreSQL and Python.",
            "Jahnavi knows PostgreSQL.",
        ),
        (
            "The server is offline.",
            "The server is online.",
        ),
        (
            "Jahnavi worked at Endava from 2024 to 2025.",
            "Jahnavi worked at Google for five years.",
        ),
    ],
)
def test_nli_response_structure(evidence, claim):
    """
    Check that the NLI service returns a valid prediction.

    This test does not assume that a probabilistic model
    always agrees with a human-assigned label.
    """

    result = verify_evidence(
        evidence=evidence,
        claim=claim,
    )

    assert result["prediction"] in {
        "entailment",
        "contradiction",
        "neutral",
    }

    assert "scores" in result

    for label in (
        "entailment",
        "contradiction",
        "neutral",
    ):
        assert label in result["scores"]
        assert 0 <= result["scores"][label] <= 1

    assert abs(sum(result["scores"].values()) - 1.0) < 0.01


def test_empty_evidence():
    with pytest.raises(ValueError):
        verify_evidence(
            evidence="",
            claim="Jahnavi knows PostgreSQL.",
        )


def test_empty_claim():
    with pytest.raises(ValueError):
        verify_evidence(
            evidence="Jahnavi knows PostgreSQL.",
            claim="",
        )


def test_invalid_evidence_type():
    with pytest.raises(ValueError):
        verify_evidence(
            evidence=None,
            claim="Jahnavi knows PostgreSQL.",
        )
