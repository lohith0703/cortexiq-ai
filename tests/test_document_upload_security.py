
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth_router import get_current_user
from app.database import get_db
from app.main import app
from app.models import Document, User


@pytest.fixture
def test_user():
    return User(
        id="test-upload-user-123",
        email="upload-test@example.com",
        password_hash="fake-test-hash",
        created_at=datetime.now(timezone.utc),
    )



@pytest.fixture
def mock_db():
    db = MagicMock()

    def fake_flush():
        for call in db.add.call_args_list:
            obj = call.args[0]

            if isinstance(obj, Document):
                if obj.id is None:
                    obj.id = "test-document-123"

                if obj.created_at is None:
                    obj.created_at = datetime.now(timezone.utc)

    db.flush.side_effect = fake_flush

    return db



@pytest.fixture
def client(mock_db):
    previous_overrides = app.dependency_overrides.copy()

    def override_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


def test_upload_without_token_returns_401(client):
    response = client.post(
        "/documents/upload",
        files={
            "file": (
                "sample.txt",
                BytesIO(b"This is a test document."),
                "text/plain",
            )
        },
    )

    assert response.status_code == 401


def test_upload_invalid_token_returns_401(client):
    response = client.post(
        "/documents/upload",
        headers={
            "Authorization": "Bearer invalid-token"
        },
        files={
            "file": (
                "sample.txt",
                BytesIO(b"This is a test document."),
                "text/plain",
            )
        },
    )

    assert response.status_code == 401


def test_authenticated_upload_assigns_owner(
    client,
    mock_db,
    test_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: test_user
    )

    response = client.post(
        "/documents/upload",
        files={
            "file": (
                "sample.txt",
                BytesIO(
                    b"CortexIQ securely processes enterprise "
                    b"documents using retrieval augmented generation."
                ),
                "text/plain",
            )
        },
    )

    assert response.status_code in (200, 201), response.text

    documents = [
        call.args[0]
        for call in mock_db.add.call_args_list
        if isinstance(call.args[0], Document)
    ]

    assert len(documents) == 1

    document = documents[0]

    assert document.owner_id == test_user.id
    assert document.filename == "sample.txt"

    mock_db.commit.assert_called_once()


def test_upload_does_not_accept_client_owner_id(
    client,
    mock_db,
    test_user,
):
    app.dependency_overrides[get_current_user] = (
        lambda: test_user
    )

    response = client.post(
        "/documents/upload",
        data={
            "owner_id": "attacker-controlled-user-id"
        },
        files={
            "file": (
                "sample.txt",
                BytesIO(
                    b"Ownership must come from the authenticated user."
                ),
                "text/plain",
            )
        },
    )

    assert response.status_code in (200, 201), response.text

    documents = [
        call.args[0]
        for call in mock_db.add.call_args_list
        if isinstance(call.args[0], Document)
    ]

    assert len(documents) == 1
    assert documents[0].owner_id == test_user.id
