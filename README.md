# CortexIQ AI

### AI-Powered Knowledge Intelligence & Research Workspace

CortexIQ AI is a full-stack AI application designed to transform uploaded documents into a searchable, conversational knowledge base.

It combines Retrieval-Augmented Generation (RAG), hybrid search, vector embeddings, intelligent reranking, and evidence-linked responses to help users discover information, investigate documents, and interact with their knowledge through natural language.

Built with Python, FastAPI, React, PostgreSQL, pgvector, and Ollama.

## Key Features

### 1. AI-Powered Knowledge Base
- Upload and process supported documents.
- Extract and organize document content.
- Automatically generate embeddings and index document chunks.
- Manage documents through a dedicated knowledge workspace.

### 2. Hybrid Intelligent Search
- Semantic search using vector embeddings.
- Keyword-based retrieval.
- Reciprocal Rank Fusion (RRF) to combine search results.
- Relevance-based reranking.
- Expandable document previews and source references.

### 3. Conversational AI Assistant
- Ask natural-language questions about uploaded documents.
- Generate context-grounded responses using RAG.
- Display citations and supporting document passages.
- Maintain conversation history.
- Support follow-up questions using previous conversation context.
- Return a fallback response when relevant evidence cannot be found.

### 4. Experimental Evidence Verification
- Extract citation-linked claims from generated answers.
- Match claims with retrieved evidence.
- Evaluate evidence relationships using a DeBERTa-based NLI model.
- Report entailment, contradiction, and neutral predictions.

Evidence verification is experimental and does not guarantee factual correctness.

### 5. Authentication and Data Isolation
- JWT-based user authentication.
- User-specific document access.
- Ownership checks for conversations.
- User-scoped retrieval to help prevent cross-account data exposure.

### 6. Modern Web Interface
- Responsive React and TypeScript frontend.
- Knowledge Base dashboard.
- Intelligent Search interface.
- Conversational AI workspace.
- Document citations and expandable search results.

## Technology Stack

| Category | Technologies |
|---|---|
| Programming | Python, TypeScript, SQL |
| Frontend | React, Vite, Tailwind CSS |
| Backend | FastAPI |
| Database | PostgreSQL, pgvector |
| AI Model | Qwen2.5 3B through Ollama |
| AI Architecture | Retrieval-Augmented Generation (RAG) |
| Search | Semantic Retrieval, Keyword Search, RRF |
| Evidence Verification | DeBERTa NLI |
| Authentication | JWT |
| Infrastructure | Docker Compose |
| Database Migrations | Alembic |
| Testing | pytest |

## System Architecture

```text
                 CortexIQ AI
                      |
                React Frontend
                      |
                 FastAPI Backend
                      |
          Authentication / User Access
                      |
              Document Processing
                      |
          Text Extraction & Chunking
                      |
              Vector Embeddings
                      |
             PostgreSQL + pgvector
                      |
               Hybrid Retrieval
                      |
                 Reranking
                      |
                 RAG Pipeline
                      |
             Ollama / Qwen2.5 3B
                      |
            Citation-Linked Answer
                      |
          Optional NLI Verification
                      |
                 React Frontend
```

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
│   └── package.json
├── migrations/
├── tests/
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
└── README.md
```

## Getting Started

### Prerequisites

Install the following:

- Python
- Node.js and npm
- Docker Desktop
- Ollama
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/lohith0703/cortexiq-ai.git
cd cortexiq-ai
```

### 2. Configure Environment Variables

Create a local `.env` file with the settings required by the backend and database configuration.

Keep database credentials, JWT secrets, and other sensitive values private. Do not commit your `.env` file to GitHub.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Install Backend Dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 5. Apply Database Migrations

```bash
alembic upgrade head
```

### 6. Start the AI Model

Install Ollama and download the model:

```bash
ollama pull qwen2.5:3b
```

Ensure the Ollama service is running.

### 7. Run the Backend

```bash
uvicorn app.main:app --reload
```

Backend API:

http://localhost:8000

Interactive API documentation:

http://localhost:8000/docs

### 8. Run the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

http://localhost:5173

## Testing

CortexIQ AI includes automated tests for backend APIs, authentication, retrieval, document processing, citation handling, and evidence-verification components.

Run the backend test suite:

```bash
python -m pytest -q
```

**Latest local test result: 111 tests passed.**

Build the frontend:

```bash
cd frontend
npm run build
```

The latest local frontend production build completed successfully.

The NLI tests validate response structure and input handling; they do not establish classification accuracy.

## Development Status

**Current stage:** Functional local application, preparing for public deployment.

Completed:
- Document processing and indexing
- Hybrid search and reranking
- Conversational RAG
- Conversation history
- JWT authentication
- User-scoped document retrieval
- Experimental NLI evidence analysis
- React frontend
- Automated backend tests

Planned improvements:
- Public deployment
- Configurable cloud inference
- Production observability
- Retrieval quality benchmarking
- Expanded integration and security testing

## Author

**Lohith Chennaboina**

Master of Engineering in Computer Science
University of Cincinnati

GitHub: https://github.com/lohith0703

## License

No open-source license has been selected for this project.
