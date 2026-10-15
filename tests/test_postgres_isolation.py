
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.database import SessionLocal
from app.embedding_service import generate_embedding
from app.hybrid_search import hybrid_search
from app.models import Document, DocumentChunk, User
from app.search_service import semantic_search


@pytest.fixture
def isolated_data():
    db = SessionLocal()
    suffix = uuid4().hex[:12]

    user_a = User(
        id=str(uuid4()),
        email=f"test-a-{suffix}@example.com",
        password_hash="test-only-hash",
    )

    user_b = User(
        id=str(uuid4()),
        email=f"test-b-{suffix}@example.com",
        password_hash="test-only-hash",
    )

    text_a = (
        "Project Apollo uses a confidential "
        "blue deployment key."
    )

    text_b = (
        "Project Orion uses a confidential "
        "green deployment key."
    )

    document_a = Document(
        id=str(uuid4()),
        owner_id=user_a.id,
        filename=f"apollo-{suffix}.txt",
        file_type="txt",
        size_bytes=len(text_a.encode()),
        word_count=len(text_a.split()),
        extracted_text=text_a,
        status="processed",
    )

    document_b = Document(
        id=str(uuid4()),
        owner_id=user_b.id,
        filename=f"orion-{suffix}.txt",
        file_type="txt",
        size_bytes=len(text_b.encode()),
        word_count=len(text_b.split()),
        extracted_text=text_b,
        status="processed",
    )

    try:
        db.add_all([user_a, user_b])
        db.flush()

        db.add_all([document_a, document_b])
        db.flush()

        db.add_all([
            DocumentChunk(
                document_id=document_a.id,
                chunk_index=0,
                text=text_a,
                word_count=len(text_a.split()),
                embedding=generate_embedding(text_a),
            ),
            DocumentChunk(
                document_id=document_b.id,
                chunk_index=0,
                text=text_b,
                word_count=len(text_b.split()),
                embedding=generate_embedding(text_b),
            ),
        ])

        db.flush()

        yield {
            "db": db,
            "user_a": user_a,
            "user_b": user_b,
            "document_a": document_a,
            "document_b": document_b,
        }

    finally:
        db.rollback()
        db.close()


def test_semantic_user_a(isolated_data):
    data = isolated_data

    results = semantic_search(
        db=data["db"],
        query="confidential deployment key",
        user_id=data["user_a"].id,
        limit=20,
    )

    ids = {result["document_id"] for result in results}

    assert data["document_a"].id in ids
    assert data["document_b"].id not in ids


def test_semantic_user_b(isolated_data):
    data = isolated_data

    results = semantic_search(
        db=data["db"],
        query="confidential deployment key",
        user_id=data["user_b"].id,
        limit=20,
    )

    ids = {result["document_id"] for result in results}

    assert data["document_b"].id in ids
    assert data["document_a"].id not in ids


def test_hybrid_user_a(isolated_data):
    data = isolated_data

    results = hybrid_search(
        db=data["db"],
        query="confidential deployment key",
        user_id=data["user_a"].id,
        limit=20,
    )

    ids = {result["document_id"] for result in results}

    assert data["document_a"].id in ids
    assert data["document_b"].id not in ids


def test_hybrid_user_b(isolated_data):
    data = isolated_data

    results = hybrid_search(
        db=data["db"],
        query="confidential deployment key",
        user_id=data["user_b"].id,
        limit=20,
    )

    ids = {result["document_id"] for result in results}

    assert data["document_b"].id in ids
    assert data["document_a"].id not in ids


def test_cross_user_document_access(isolated_data):
    data = isolated_data

    statement = select(Document).where(
        Document.id == data["document_b"].id,
        Document.owner_id == data["user_a"].id,
    )

    assert data["db"].scalar(statement) is None
