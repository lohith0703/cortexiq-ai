
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.auth_router import get_current_user


@pytest.fixture
def client():
    """
    Authenticated test client with a mocked database.

    Dependency overrides are removed after each test.
    """

    test_user = SimpleNamespace(
        id="test-user-chat-api",
        email="chat-test@example.com",
        created_at=datetime.now(timezone.utc),
    )

    mock_db = MagicMock()

    def override_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def sample_response(verification=None):
    return {
        "question": "What technologies are mentioned?",
        "answer": "Python and Docker are mentioned [1].",
        "sources": [
            {
                "citation": "[1]",
                "document_id": "test-document",
                "filename": "test.pdf",
                "chunk_id": 1,
                "text": "Python and Docker are mentioned.",
            }
        ],
        "model": "qwen2.5:3b",
        "citation_validation": {
            "has_citations": True,
            "references_valid": True,
            "valid_citations": ["[1]"],
            "invalid_citations": [],
            "unused_citations": [],
            "citation_count": 1,
            "validation_type": "reference_integrity",
        },
        "evidence_verification": verification,
    }


@patch("app.main.answer_question")
def test_chat_without_verification(mock_answer, client):
    mock_answer.return_value = sample_response()

    response = client.post(
        "/chat/ask",
        json={
            "question": "What technologies are mentioned?",
            "top_k": 3,
            "verify_evidence": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["evidence_verification"] is None

    assert (
        mock_answer.call_args.kwargs["verify_evidence"]
        is False
    )


@patch("app.main.answer_question")
def test_chat_with_verification(mock_answer, client):
    verification = {
        "verification_type": "experimental_nli",
        "total_extracted_claims": 1,
        "matched_count": 1,
        "unmatched_count": 0,
        "unmatched_claims": [],
        "verified_claims": [
            {
                "claim": "Python and Docker are mentioned.",
                "citation": "[1]",
                "prediction": "entailment",
                "scores": {
                    "entailment": 0.95,
                    "contradiction": 0.02,
                    "neutral": 0.03,
                },
                "model": "mock-model",
            }
        ],
        "prediction_counts": {
            "entailment": 1,
            "contradiction": 0,
            "neutral": 0,
        },
    }

    mock_answer.return_value = sample_response(
        verification=verification
    )

    response = client.post(
        "/chat/ask",
        json={
            "question": "What technologies are mentioned?",
            "top_k": 3,
            "verify_evidence": True,
        },
    )

    assert response.status_code == 200

    result = response.json()

    assert result["evidence_verification"]["matched_count"] == 1

    assert (
        result["evidence_verification"]["prediction_counts"][
            "entailment"
        ]
        == 1
    )


def test_invalid_top_k(client):
    response = client.post(
        "/chat/ask",
        json={
            "question": "What technologies are mentioned?",
            "top_k": 10,
        },
    )

    assert response.status_code == 422


def test_empty_question(client):
    response = client.post(
        "/chat/ask",
        json={
            "question": "",
            "top_k": 3,
        },
    )

    assert response.status_code == 422


@patch("app.main.answer_question")
def test_verification_defaults_to_false(mock_answer, client):
    mock_answer.return_value = sample_response()

    response = client.post(
        "/chat/ask",
        json={
            "question": "What technologies are mentioned?",
        },
    )

    assert response.status_code == 200

    assert (
        mock_answer.call_args.kwargs["verify_evidence"]
        is False
    )
