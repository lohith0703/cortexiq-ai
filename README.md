# CortexIQ AI

### Enterprise Document Intelligence & Retrieval-Augmented Generation Platform

**A full-stack AI platform for transforming documents into searchable knowledge and evidence-grounded conversations.**

[Live Application](https://cortexiq-ai.vercel.app/) | [API Documentation](https://cortexiq-ai.onrender.com/docs) | [GitHub Repository](https://github.com/lohith0703/cortexiq-ai)

---

## Overview

CortexIQ AI is a deployed, full-stack document intelligence application that enables users to upload documents, retrieve relevant information, and interact with their knowledge through natural-language conversations.

The platform implements a multi-stage Retrieval-Augmented Generation (RAG) architecture combining dense vector retrieval, keyword search, Reciprocal Rank Fusion (RRF), cross-encoder reranking, and citation-aware answer generation.

Unlike a basic chatbot that relies primarily on pretrained model knowledge, CortexIQ retrieves supporting passages from indexed documents before generating responses.

The system integrates document processing, transformer-based embeddings, vector storage, retrieval orchestration, LLM inference, authentication, persistent conversations, and cloud deployment.

**Core engineering focus:**
- End-to-end RAG system development
- Hybrid information retrieval
- Transformer-based embeddings and reranking
- Resource-efficient ONNX model inference
- Evidence-grounded LLM responses
- API and database engineering
- Cloud deployment and full-stack integration

---

## Key Features

### 1. Document Knowledge Base

- Upload and process supported PDF and DOCX documents.
- Extract text and divide documents into retrievable chunks.
- Generate dense vector embeddings for document passages.
- Store document metadata, chunks, and embeddings in PostgreSQL with pgvector.
- Manage indexed documents through a dedicated knowledge workspace.

### 2. Multi-Stage Hybrid Retrieval

CortexIQ combines complementary retrieval strategies to identify relevant passages.

- **Dense retrieval:** Semantic similarity using transformer embeddings.
- **Keyword retrieval:** Lexical matching for relevant terminology.
- **Reciprocal Rank Fusion:** Combines results from multiple retrieval methods.
- **Cross-encoder reranking:** Scores query-passage pairs to reorder candidate passages.
- **Source traceability:** Returns relevant passages with document references.

The multi-stage design aims to improve retrieval relevance before passing evidence to the language model.

### 3. Conversational RAG Assistant

- Ask natural-language questions about indexed documents.
- Retrieve supporting information from the user's knowledge base.
- Generate context-grounded responses using a configured LLM.
- Display citations and supporting document passages.
- Maintain persistent conversation history.
- Support follow-up questions using conversation context.
- Handle insufficient-evidence scenarios.

### 4. Authentication and User-Scoped Retrieval

- JWT-based user authentication.
- Argon2 password hashing.
- User-specific document access controls.
- Ownership checks for conversations.
- User-scoped retrieval to limit cross-account data access.

These mechanisms provide application-level access controls but have not undergone an independent security audit.

### 5. Experimental Evidence Verification

The project includes an experimental natural-language inference (NLI) workflow designed to compare generated claims with supporting evidence.

- Extract citation-linked claims.
- Associate claims with retrieved evidence.
- Evaluate entailment, contradiction, and neutral relationships.
- Return structured evidence-analysis results.

**Production limitation:** The lightweight cloud deployment does not include the experimental DeBERTa NLI model. Evidence verification is not available as a supported production feature and does not guarantee factual correctness.

### 6. Full-Stack Application

- React and TypeScript frontend.
- FastAPI REST backend.
- Knowledge Base dashboard.
- Intelligent Search workspace.
- Conversational AI Assistant.
- Persistent user and conversation data.
- Cloud-hosted frontend, backend, and database.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Programming Languages | Python, TypeScript, SQL |
| Frontend | React, Vite, Tailwind CSS |
| Backend | FastAPI, Uvicorn |
| Database | PostgreSQL, pgvector |
| Database Migrations | Alembic |
| Embedding Model | sentence-transformers/all-MiniLM-L6-v2 |
| Reranking Model | cross-encoder/ms-marco-MiniLM-L6-v2 |
| Model Inference | ONNX Runtime, Hugging Face Tokenizers |
| LLM — Cloud | GPT-OSS 20B via Groq API |
| LLM — Local | Qwen2.5 3B via Ollama |
| Retrieval | Dense Search, Keyword Search, RRF |
| AI Architecture | Retrieval-Augmented Generation |
| Authentication | JWT, Argon2 |
| Infrastructure | Docker, Vercel, Render, Neon |
| Testing | pytest |

---

## System Architecture

```text
                         USER
                           |
                           v
                  React + TypeScript
                      Vercel
                           |
                           v
                     FastAPI API
                    Render Docker
                           |
             +-------------+-------------+
             |                           |
             v                           v
       Authentication              Document Ingestion
        JWT / Argon2                     |
             |                           v
             |                    Text Extraction
             |                           |
             |                           v
             |                        Chunking
             |                           |
             |                           v
             |                   Embedding Generation
             |                       ONNX Runtime
             |                           |
             +-------------+-------------+
                           |
                           v
                  Neon PostgreSQL
                       pgvector
                           |
                           v
                    User Question
                           |
                           v
                    Query Embedding
                           |
                           v
                    Hybrid Retrieval
                  /                 \
                 v                   v
          Dense Vector          Keyword Search
             Search                  |
                 \                   /
                  v                 v
                 Reciprocal Rank Fusion
                           |
                           v
                    Candidate Passages
                           |
                           v
                   Cross-Encoder Reranking
                        ONNX Runtime
                           |
                           v
                     Context Assembly
                           |
                           v
                     Groq LLM API
                           |
                           v
                     RAG Response
                           |
                           v
                    Citation Validation
                           |
                           v
                    React Frontend
```

The application separates document ingestion and indexing from query-time retrieval and generation.

This enables previously indexed document content to be reused across multiple questions without repeating the entire ingestion process.

---

## RAG Pipeline: End-to-End Workflow

### Stage 1 — Document Ingestion

When a user uploads a document:

1. The backend authenticates the request.
2. The document is processed and its text is extracted.
3. Extracted text is divided into chunks.
4. Each chunk is converted into a dense vector embedding.
5. Embeddings and associated metadata are stored in PostgreSQL using pgvector.
6. Indexed content becomes available for retrieval.

### Stage 2 — Hybrid Retrieval

When a user submits a question:

1. The backend receives the question and identifies the user's accessible documents.
2. The question is converted into a vector embedding.
3. Dense vector retrieval identifies semantically similar passages.
4. Keyword search identifies lexically relevant passages.
5. Reciprocal Rank Fusion combines the retrieval results.
6. Candidate passages are passed to a cross-encoder for relevance scoring.
7. The reranked passages are selected for context construction.

### Stage 3 — LLM Answer Generation

1. Retrieved passages are assembled into the generation context.
2. The backend constructs the LLM request using the question and supporting evidence.
3. The configured language model generates a response.
4. Citation references are checked against retrieved sources.
5. The final response and supporting references are returned to the frontend.
6. Conversation history is maintained for subsequent interactions.

### Why Hybrid Retrieval?

Dense retrieval can identify semantically related passages even when wording differs.

Keyword retrieval can preserve exact terminology, identifiers, and lexical matches that may not rank highly through semantic similarity alone.

Combining both methods allows the system to use complementary retrieval signals.

Cross-encoder reranking adds another relevance-scoring stage before the selected passages reach the LLM.

---

## Machine Learning Inference Architecture

CortexIQ uses two transformer-based models for its retrieval pipeline.

### Embedding Model

**Model:** `sentence-transformers/all-MiniLM-L6-v2`

**Embedding dimension:** 384

**Purpose:** Convert document chunks and user questions into dense numerical representations suitable for semantic similarity search.

**Runtime:** ONNX Runtime on CPU.

The implementation uses tokenization, transformer inference, mean pooling, and vector normalization.

The resulting embeddings are stored and queried using PostgreSQL with pgvector.

### Cross-Encoder Reranking Model

**Model:** `cross-encoder/ms-marco-MiniLM-L6-v2`

**Purpose:** Estimate the relevance of a candidate passage to a user question.

Unlike independent embedding similarity, the cross-encoder evaluates the question and candidate passage together.

This provides a more detailed relevance signal at the cost of additional inference work per candidate.

**Runtime:** ONNX Runtime on CPU.

### Why ONNX Runtime?

The deployment environment has limited memory and CPU resources.

Using ONNX Runtime allows the application to execute the required transformer models without loading the full PyTorch inference stack in the production container.

The approach prioritizes:

- Reduced dependency overhead.
- CPU inference compatibility.
- Deployment within constrained infrastructure.
- Retention of transformer-based embedding and reranking capabilities.

The project does not claim benchmarked latency or throughput improvements without controlled measurements.

---

## Engineering Challenges & Architectural Decisions

### 1. Resource-Efficient Transformer Inference

**Challenge:** Running transformer-based embedding and reranking models alongside a Python API in a memory-constrained cloud container created deployment and dependency challenges.

**Engineering Decision:** Implemented CPU inference using ONNX Runtime and Hugging Face Tokenizers, replacing the heavier PyTorch-based production inference path.

**Trade-off:** Prioritized a smaller runtime dependency footprint and compatibility with limited cloud resources over GPU-accelerated inference.

**Outcome:** Successfully built and deployed the FastAPI application with ONNX-based embedding generation and cross-encoder reranking.

### 2. Multi-Stage Retrieval Architecture

**Challenge:** Semantic retrieval captures conceptual similarity, while keyword search helps preserve exact terminology. Neither method alone addresses every retrieval scenario.

**Engineering Decision:** Designed a retrieval pipeline combining dense vector similarity, keyword retrieval, Reciprocal Rank Fusion, and cross-encoder reranking.

**Trade-off:** Cross-encoder reranking introduces additional inference work but provides more detailed relevance scoring before passages are supplied to the LLM.

**Outcome:** Implemented hybrid retrieval and reranking for document-grounded answer generation. Quantitative retrieval-quality benchmarking remains planned.

### 3. Grounded Generation and Citation Traceability

**Challenge:** LLM-generated responses can contain unsupported statements or references that do not correspond to retrieved evidence.

**Engineering Decision:** Built a citation-aware RAG pipeline that supplies retrieved passages as context and validates citation references against available sources.

**Trade-off:** Citation validation improves source traceability but does not independently prove that every generated claim is factually supported.

**Outcome:** Delivered document-grounded responses with supporting source references while retaining advanced NLI-based verification as an experimental component.

### 4. Cloud-Native Full-Stack Integration

**Challenge:** Integrating a separately hosted frontend, backend, database, and external LLM inference service requires consistent API routing, environment configuration, and deployment management.

**Engineering Decision:** Deployed React on Vercel, containerized FastAPI on Render, integrated Neon PostgreSQL with pgvector, and used Groq for cloud LLM inference.

**Trade-off:** Managed cloud services simplify infrastructure setup but introduce external dependencies, cold-start behavior, and free-tier resource constraints.

**Outcome:** Deployed an accessible end-to-end AI application supporting authentication, document ingestion, retrieval, and conversational question answering.

---

## Deployment Architecture

| Component | Platform | Responsibility |
|---|---|---|
| Frontend | Vercel | Host the React application |
| Backend | Render | Run the Dockerized FastAPI service |
| Database | Neon | Persist application data and vector embeddings |
| LLM | Groq | Provide cloud language model inference |
| ML Inference | ONNX Runtime | Run embeddings and reranking on CPU |

### Live Endpoints

**Frontend:** https://cortexiq-ai.vercel.app/

**Backend API:** https://cortexiq-ai.onrender.com

**Interactive API Documentation:** https://cortexiq-ai.onrender.com/docs

The frontend uses an API rewrite to route requests to the backend service.

### Deployment Limitations

The current deployment uses free-tier cloud infrastructure.

Consequently:

- The backend may enter an idle state and require a cold start.
- Response times may vary with external LLM service latency.
- Available memory and CPU capacity constrain concurrent workloads.
- No production availability or performance guarantees are provided.

This deployment serves as a functional engineering portfolio demonstration.

---

## Project Structure

```text
cortexiq-ai/
├── app/
│   ├── main.py
│   ├── auth_router.py
│   ├── chat_history_router.py
│   ├── chunking.py
│   ├── embedding_service.py
│   ├── hybrid_search.py
│   ├── rag_service.py
│   ├── reranking_service.py
│   ├── citation_service.py
│   ├── evidence_service.py
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── assistant/
│   │   ├── auth/
│   │   ├── knowledge/
│   │   └── search/
│   ├── vercel.json
│   └── package.json
├── migrations/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
└── README.md
```

---

## Getting Started

### Prerequisites

- Python
- Node.js and npm
- Git
- PostgreSQL with pgvector support
- Access to a configured LLM provider
- Docker for container-based deployment

### 1. Clone the Repository

```bash
git clone https://github.com/lohith0703/cortexiq-ai.git
cd cortexiq-ai
```

### 2. Configure Environment Variables

Create a `.env` file in the project root.

Example cloud configuration:

```dotenv
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET_KEY=your_secure_random_secret
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
TOKENIZERS_PARALLELISM=false
```

The database must have pgvector support enabled.

**Security:** Never commit `.env` files, database passwords, JWT secrets, or API keys to the repository.

### 3. Install Backend Dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The cloud inference path also requires the ONNX model artifacts used by the embedding and reranking services. The Docker deployment prepares these artifacts during image construction.

### 4. Apply Database Migrations

```bash
alembic upgrade head
```

### 5. Start the Backend

```bash
uvicorn app.main:app --reload
```

Backend:

http://localhost:8000

API documentation:

http://localhost:8000/docs

### 6. Start the Frontend

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

http://localhost:5173

### 7. Docker Deployment

Build the backend image:

```bash
docker build --platform linux/amd64 -t cortexiq-backend .
```

Run with your environment configuration:

```bash
docker run --rm --platform linux/amd64 \
  -p 8000:8000 \
  --env-file .env \
  -e PORT=8000 \
  cortexiq-backend
```

The backend must be able to connect to the configured PostgreSQL database and LLM provider.

---

## Testing and Validation

CortexIQ includes automated backend tests covering application behavior such as:

- Authentication
- Document processing
- Retrieval functionality
- Citation handling
- Conversation-related functionality
- Evidence verification components

Run the backend test suite:

```bash
python -m pytest -q
```

**Latest verified local result: 111 tests passed.**

Build the frontend:

```bash
cd frontend
npm run build
```

The frontend production build was completed successfully during development.

### Validation Scope

The existing automated tests provide functional regression coverage.

They do not establish:

- Production security certification
- Retrieval accuracy on a representative benchmark
- LLM factual correctness
- High-concurrency reliability
- Production latency or throughput guarantees

The experimental NLI tests validate application behavior and response handling rather than establishing model classification accuracy.

---

## Current Development Status

**Status: Deployed portfolio application with ongoing engineering improvements.**

### Implemented

- Document ingestion and indexing
- Transformer-based vector embeddings
- PostgreSQL and pgvector integration
- Hybrid semantic and keyword retrieval
- Reciprocal Rank Fusion
- Cross-encoder reranking
- Retrieval-Augmented Generation
- Citation-linked responses
- Persistent conversation history
- JWT authentication
- React and TypeScript frontend
- ONNX-based production inference
- Dockerized backend
- Vercel, Render, and Neon deployment
- Automated backend tests

### Planned Improvements

**Retrieval Evaluation**
- Build a labeled retrieval evaluation dataset.
- Measure Recall@K, MRR, and related ranking metrics.
- Compare dense retrieval, hybrid retrieval, and reranking configurations.

**LLM Evaluation**
- Evaluate answer relevance and faithfulness.
- Measure citation correctness against supporting passages.
- Test insufficient-evidence behavior.

**Performance Engineering**
- Measure p50 and p95 API latency.
- Benchmark embedding and reranking inference.
- Evaluate concurrent request handling.
- Explore caching and batching strategies.

**Reliability and Security**
- Expand multi-user authorization tests.
- Introduce rate limiting and resource quotas.
- Add structured monitoring and observability.
- Improve error handling and operational documentation.

**Scalability**
- Investigate asynchronous ingestion and background workers.
- Explore retrieval indexing and query optimization.
- Evaluate infrastructure options for higher traffic.

---

## Security and Privacy

CortexIQ includes authentication and user-scoped access controls.

However, the public deployment has not undergone a comprehensive independent security assessment and should not be used to store confidential, regulated, or sensitive information.

All API credentials and database secrets must be configured through environment variables and excluded from version control.

---

## Author

**Lohith Chennaboina**

Master of Engineering in Computer Science  
University of Cincinnati

GitHub: https://github.com/lohith0703

---

## License

No open-source license has been selected for this project.