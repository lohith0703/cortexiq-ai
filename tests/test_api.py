
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth_router import get_current_user
from app.database import get_db
from app.main import app


@pytest.fixture
def client():
    """Authenticated API client with a mocked database."""

    test_user = SimpleNamespace(
        id="test-user-upload-api",
        email="upload-test@example.com",
        created_at=datetime.now(timezone.utc),
    )

    mock_db = MagicMock()

    def fake_flush():
        """Simulate database-generated document fields."""
        for call in mock_db.add.call_args_list:
            obj = call.args[0]

            if hasattr(obj, "filename"):
                if getattr(obj, "id", None) is None:
                    obj.id = "test-document-001"

                if getattr(obj, "created_at", None) is None:
                    obj.created_at = datetime.now(timezone.utc)

    def fake_refresh(obj):
        """Ensure database-generated fields exist after refresh."""
        if getattr(obj, "id", None) is None:
            obj.id = "test-document-001"

        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)

    mock_db.flush.side_effect = fake_flush
    mock_db.refresh.side_effect = fake_refresh

    def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[get_db] = override_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


def test_health_check(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_upload_txt_document(client):
    with patch(
        "app.main.generate_embeddings",
        return_value=[[0.0] * 384],
    ):
        response = client.post(
            "/documents/upload",
            files={
                "file": (
                    "sample.txt",
                    b"CortexIQ processes enterprise documents.",
                    "text/plain",
                )
            },
        )

    assert response.status_code == 201

    data = response.json()

    assert data["filename"] == "sample.txt"
    assert data["file_type"] == "txt"
    assert data["word_count"] == 4
    assert data["status"] == "processed"
    assert data["id"]
    assert "CortexIQ" in data["text_preview"]


def test_reject_unsupported_file(client):
    response = client.post(
        "/documents/upload",
        files={
            "file": (
                "script.exe",
                b"not a document",
                "application/octet-stream",
            )
        },
    )

    assert response.status_code == 400


def test_reject_empty_document(client):
    response = client.post(
        "/documents/upload",
        files={
            "file": (
                "empty.txt",
                b"",
                "text/plain",
            )
        },
    )

    assert response.status_code == 400
