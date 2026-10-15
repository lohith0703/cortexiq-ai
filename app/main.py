
from datetime import datetime
from pathlib import Path

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_router import (
    get_current_user,
    router as auth_router,
)
from app.chat_history_router import router as chat_history_router

from app.chunking import chunk_text
from app.database import get_db
from app.document_service import (
    DocumentProcessingError,
    MAX_FILE_SIZE,
    extract_text,
)
from app.embedding_service import generate_embeddings
from app.hybrid_search import hybrid_search
from app.indexing_service import index_document
from app.llm_service import LLMServiceError
from app.models import Document, DocumentChunk, User
from app.rag_service import answer_question
from app.search_service import semantic_search


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="CortexIQ API",
    description="Enterprise Knowledge Intelligence Platform",
    version="0.5.0",
)

app.include_router(auth_router)
app.include_router(chat_history_router)

# ============================================================
# DOCUMENT RESPONSE MODELS
# ============================================================

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    size_bytes: int
    word_count: int
    status: str
    created_at: datetime


class DocumentDetail(DocumentResponse):
    text_preview: str


class ChunkResponse(BaseModel):
    index: int
    text: str
    word_count: int
    start_word: int
    end_word: int


class DocumentChunksResponse(BaseModel):
    document_id: str
    total_chunks: int
    chunks: list[ChunkResponse]


# ============================================================
# SEARCH REQUEST AND RESPONSE MODELS
# ============================================================

class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    chunk_id: int
    document_id: str
    filename: str
    chunk_index: int
    text: str
    similarity_score: float


class HybridSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=5, ge=1, le=20)
    semantic_weight: float = Field(
        default=0.7,
        ge=0,
        le=1,
    )


class HybridSearchResult(BaseModel):
    chunk_id: int
    document_id: str
    filename: str
    chunk_index: int
    text: str
    rrf_score: float


# ============================================================
# HOME AND HEALTH ENDPOINTS
# ============================================================

@app.get("/")
def home():
    return {
        "application": "CortexIQ",
        "version": "0.5.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "cortexiq-api",
    }


# ============================================================
# DOCUMENT OWNERSHIP HELPER
# ============================================================

def get_owned_document(
    db: Session,
    document_id: str,
    user_id: str,
) -> Document:
    """
    Retrieve a document only when it belongs
    to the authenticated user.

    Return 404 for both nonexistent documents
    and documents owned by other users.
    """

    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.owner_id == user_id,
        )
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    return document


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@app.post(
    "/documents/upload",
    response_model=DocumentDetail,
    status_code=201,
)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = Path(file.filename or "").name

    if not filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 10 MB.",
        )

    try:
        text = extract_text(filename, content)

    except DocumentProcessingError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    chunks = chunk_text(
        text,
        chunk_size=200,
        overlap=40,
    )

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="The document contains no extractable text.",
        )

    # Generate embeddings before saving.
    embeddings = generate_embeddings(
        [chunk.text for chunk in chunks]
    )

    document = Document(
        owner_id=current_user.id,
        filename=filename,
        file_type=Path(filename).suffix.lower().lstrip("."),
        size_bytes=len(content),
        word_count=len(text.split()),
        extracted_text=text,
        status="processed",
    )

    try:
        db.add(document)
        db.flush()

        for chunk, embedding in zip(
            chunks,
            embeddings,
            strict=True,
        ):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk.index,
                    text=chunk.text,
                    word_count=chunk.word_count,
                    embedding=embedding,
                )
            )

        db.commit()
        db.refresh(document)

    except Exception:
        db.rollback()
        raise

    return DocumentDetail(
        **DocumentResponse.model_validate(
            document
        ).model_dump(),
        text_preview=document.extracted_text[:500],
    )


# ============================================================
# LIST DOCUMENTS — OWNER FILTERED
# ============================================================

@app.get(
    "/documents",
    response_model=list[DocumentResponse],
)
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Document)
        .where(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
    )

    return db.scalars(statement).all()


# ============================================================
# GET DOCUMENT CHUNKS — OWNER FILTERED
# ============================================================

@app.get(
    "/documents/{document_id}/chunks",
    response_model=DocumentChunksResponse,
)
def get_document_chunks(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_owned_document(
        db=db,
        document_id=document_id,
        user_id=current_user.id,
    )

    chunks = chunk_text(
        document.extracted_text,
        chunk_size=200,
        overlap=40,
    )

    return DocumentChunksResponse(
        document_id=document.id,
        total_chunks=len(chunks),
        chunks=[
            ChunkResponse(
                index=chunk.index,
                text=chunk.text,
                word_count=chunk.word_count,
                start_word=chunk.start_word,
                end_word=chunk.end_word,
            )
            for chunk in chunks
        ],
    )


# ============================================================
# GET SINGLE DOCUMENT — OWNER FILTERED
# ============================================================

@app.get(
    "/documents/{document_id}",
    response_model=DocumentDetail,
)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_owned_document(
        db=db,
        document_id=document_id,
        user_id=current_user.id,
    )

    return DocumentDetail(
        **DocumentResponse.model_validate(
            document
        ).model_dump(),
        text_preview=document.extracted_text[:500],
    )


# ============================================================
# DELETE DOCUMENT — OWNER FILTERED
# ============================================================

@app.delete(
    "/documents/{document_id}",
    status_code=204,
)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_owned_document(
        db=db,
        document_id=document_id,
        user_id=current_user.id,
    )

    chunks = db.scalars(
        select(DocumentChunk).where(
            DocumentChunk.document_id == document.id
        )
    ).all()

    try:
        for chunk in chunks:
            db.delete(chunk)

        db.delete(document)
        db.commit()

    except Exception:
        db.rollback()
        raise

    return None


# ============================================================
# SEMANTIC SEARCH — TEMPORARILY DISABLED
# ============================================================


@app.post(
    "/search/semantic",
    response_model=list[SearchResult],
)
def search_documents(
    request: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return semantic_search(
            db=db,
            query=request.query,
            user_id=current_user.id,
            limit=request.limit,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error



# ============================================================
# HYBRID SEARCH — TEMPORARILY DISABLED
# ============================================================


@app.post(
    "/search/hybrid",
    response_model=list[HybridSearchResult],
)
def search_hybrid(
    request: HybridSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return hybrid_search(
            db=db,
            query=request.query,
            user_id=current_user.id,
            limit=request.limit,
            semantic_weight=request.semantic_weight,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error



# ============================================================
# INDEX EXISTING DOCUMENT — OWNER FILTERED
# ============================================================

@app.post("/documents/{document_id}/index")
def index_existing_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify ownership before indexing.
    get_owned_document(
        db=db,
        document_id=document_id,
        user_id=current_user.id,
    )

    try:
        return index_document(
            db=db,
            document_id=document_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# CHAT REQUEST MODEL
# ============================================================

class ChatRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=2000,
    )

    top_k: int = Field(
        default=3,
        ge=1,
        le=5,
    )

    verify_evidence: bool = False


# ============================================================
# CHAT SOURCE MODEL
# ============================================================

class ChatSource(BaseModel):
    citation: str
    document_id: str
    filename: str
    chunk_id: int
    text: str


# ============================================================
# CITATION VALIDATION MODEL
# ============================================================

class CitationValidationResponse(BaseModel):
    has_citations: bool
    references_valid: bool
    valid_citations: list[str]
    invalid_citations: list[str]
    unused_citations: list[str]
    citation_count: int
    validation_type: str


# ============================================================
# EVIDENCE VERIFICATION MODEL
# ============================================================

class EvidenceVerificationResponse(BaseModel):
    verification_type: str

    total_extracted_claims: int | None = None
    matched_count: int | None = None
    unmatched_count: int | None = None

    unmatched_claims: list[dict] | None = None
    verified_claims: list[dict] | None = None

    prediction_counts: dict[str, int] | None = None

    status: str | None = None
    error: str | None = None


# ============================================================
# CHAT RESPONSE MODEL
# ============================================================

class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: list[ChatSource]
    model: str

    citation_validation: CitationValidationResponse

    evidence_verification: (
        EvidenceVerificationResponse | None
    ) = None


# ============================================================
# CHAT WITH DOCUMENTS — SECURE USER-ISOLATED RAG
# ============================================================

@app.post(
    "/chat/ask",
    response_model=ChatResponse,
)
def chat_with_documents(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return answer_question(
            db=db,
            question=request.question,
            user_id=current_user.id,
            top_k=request.top_k,
            verify_evidence=request.verify_evidence,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except LLMServiceError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error
