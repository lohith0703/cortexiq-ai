
from unittest.mock import patch

import pytest

from app.verification_pipeline import run_verification_pipeline


def fake_verify_evidence(evidence, claim):
    """Simulate NLI predictions for pipeline tests."""

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
def test_complete_pipeline(mock_model):
    answer = (
        "The backend uses FastAPI [1]. "
        "The server is online [2]. "
        "The application is deployed on AWS [3]. "
        "The system uses Kubernetes [4]."
    )

    sources = [
        {
            "citation": "[1]",
            "text": "The API uses FastAPI for backend development.",
        },
        {
            "citation": "[2]",
            "text": "The server is offline.",
        },
        {
            "citation": "[3]",
            "text": "The application uses PostgreSQL.",
        },
    ]

    result = run_verification_pipeline(answer, sources)

    assert result["total_extracted_claims"] == 4
    assert result["matched_count"] == 3
    assert result["unmatched_count"] == 1

    assert result["prediction_counts"] == {
        "entailment": 1,
        "contradiction": 1,
        "neutral": 1,
    }

    assert result["unmatched_claims"][0]["citation"] == "[4]"
    assert mock_model.call_count == 3


def test_empty_answer():
    result = run_verification_pipeline("", [])

    assert result["total_extracted_claims"] == 0
    assert result["matched_count"] == 0
    assert result["unmatched_count"] == 0
    assert result["verified_claims"] == []


def test_missing_evidence():
    answer = "The backend uses FastAPI [1]."

    result = run_verification_pipeline(answer, [])

    assert result["matched_count"] == 0
    assert result["unmatched_count"] == 1
    assert result["verified_claims"] == []


def test_invalid_answer():
    with pytest.raises(ValueError):
        run_verification_pipeline(None, [])


def test_invalid_sources():
    with pytest.raises(ValueError):
        run_verification_pipeline(
            "The backend uses FastAPI [1].",
            "invalid sources",
        )


@patch(
    "app.claim_verification_service.verify_evidence",
    side_effect=fake_verify_evidence,
)
def test_duplicate_citations(mock_model):
    answer = "The backend uses FastAPI [1] [1]."

    sources = [
        {
            "citation": "[1]",
            "text": "The API uses FastAPI.",
        }
    ]

    result = run_verification_pipeline(answer, sources)

    assert result["total_extracted_claims"] == 1
    assert result["matched_count"] == 1
    assert mock_model.call_count == 1
