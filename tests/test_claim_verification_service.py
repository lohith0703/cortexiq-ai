
from unittest.mock import patch

import pytest

from app.claim_verification_service import verify_claims


def fake_verify_evidence(evidence, claim):
    """Return a predictable result without loading AI."""

    if evidence == "The server is offline.":
        prediction = "contradiction"

    elif evidence == "The application uses PostgreSQL.":
        prediction = "neutral"

    else:
        prediction = "entailment"

    return {
        "claim": claim,
        "prediction": prediction,
        "scores": {
            "entailment": 0.0,
            "contradiction": 0.0,
            "neutral": 0.0,
        },
        "model": "mock-nli-model",
    }


@patch(
    "app.claim_verification_service.verify_evidence",
    side_effect=fake_verify_evidence,
)
def test_multiple_claims(mock_model):

    claims = [
        {
            "claim": "The backend uses FastAPI.",
            "evidence": "The API uses FastAPI.",
            "citation": "[1]",
        },
        {
            "claim": "The server is online.",
            "evidence": "The server is offline.",
            "citation": "[2]",
        },
        {
            "claim": "The application is deployed on AWS.",
            "evidence": "The application uses PostgreSQL.",
            "citation": "[3]",
        },
    ]

    result = verify_claims(claims)

    assert result["total_claims"] == 3

    assert result["prediction_counts"] == {
        "entailment": 1,
        "contradiction": 1,
        "neutral": 1,
    }

    assert len(result["results"]) == 3
    assert mock_model.call_count == 3


def test_invalid_claims_type():
    with pytest.raises(ValueError):
        verify_claims("not a list")


def test_invalid_claim_item():
    with pytest.raises(ValueError):
        verify_claims(["not a dictionary"])


def test_missing_citation():
    with pytest.raises(ValueError):
        verify_claims(
            [
                {
                    "claim": "The backend uses FastAPI.",
                    "evidence": "The API uses FastAPI.",
                }
            ]
        )


def test_empty_claims():
    result = verify_claims([])

    assert result["total_claims"] == 0

    assert result["prediction_counts"] == {
        "entailment": 0,
        "contradiction": 0,
        "neutral": 0,
    }

    assert result["results"] == []
