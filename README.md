# SupportAI — RAG Customer Support Bot

A customer support chatbot with a
**polyglot microservice architecture**:

| Service | Language | Responsibility |
|---|---|---|
| `frontend` | TypeScript / React | Chat UI, document manager, user admin |
| `backend` | TypeScript / Express | Auth (JWT), session management, file upload, API gateway |
| `rag-service` | **Python / FastAPI** | PDF parsing, chunking, embeddings, ChromaDB, Ollama chat |
| `chromadb` | — | Vector store (cosine similarity) |
| `ollama` | — | Local LLM (`llama3`) + embeddings (`nomic-embed-text`) |

---

## Architecture

```
Browser
  │
  │  HTTP / SSE
  ▼
┌─────────────────────┐
│  React Frontend     │  TypeScript + Vite + Tailwind
│  (nginx :80)        │
└────────┬────────────┘
         │ REST + SSE
         ▼
┌─────────────────────┐
│  Express Backend    │  TypeScript — auth, sessions, file upload
│  (:3001)            │  Proxies RAG calls → rag-service
└────────┬────────────┘
         │ internal HTTP + SSE proxy
         ▼
┌─────────────────────┐
│  FastAPI RAG svc    │  Python — PDF→chunks→embeddings→ChromaDB
│  (:8080)            │  Ollama streaming chat with RAG context
└──────┬──────────────┘
       │              │
  embeddings       LLM chat
       ▼              ▼
┌────────────┐  ┌──────────────┐
│  ChromaDB  │  │    Ollama    │
│  (:8000)   │  │   (:11434)   │
└────────────┘  └──────────────┘
```

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- 8 GB RAM minimum (16 GB recommended for llama3)

### 1. Clone and configure
```bash
git clone <your-repo>
cd rag-support-bot
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and ADMIN_PASSWORD
```

### 2. Start everything
```bash
docker compose up -d
```

On first run this will:
1. Start **Ollama** and automatically pull `llama3` + `nomic-embed-text` (~5 GB, once only)
2. Start **ChromaDB** with persistent volume storage
3. Build and start the **Python RAG service** (FastAPI)
4. Build and start the **TypeScript Express backend**
5. Build and start the **React frontend** via nginx

### 3. Open the app
```
http://localhost
```

Default credentials: `admin@support.local` / `admin1234`

### 4. Upload PDFs
Sidebar → **Documents** → drag-and-drop your PDFs → wait for ingestion confirmation.

---

## Development (without Docker)

### Python RAG service
```bash
cd rag-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start ChromaDB
docker run -p 8000:8000 chromadb/chroma

# Start Ollama
ollama serve
ollama pull llama3
ollama pull nomic-embed-text

# Run service
uvicorn main:app --reload --port 8080
```

### TypeScript backend
```bash
cd backend
npm install
# Create .env with:
#   RAG_SERVICE_URL=http://localhost:8080
#   JWT_SECRET=dev-secret
npm run dev
```

### React frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## Project Structure

```
rag-support-bot/
├── rag-service/              ← Python RAG microservice
│   ├── main.py               # FastAPI app + all routes
│   ├── config.py             # Pydantic settings
│   ├── schemas.py            # Request/response models
│   ├── vector_store.py       # ChromaDB client + embeddings
│   ├── pdf_parser.py         # PDF extraction + LangChain chunking
│   ├── chat_service.py       # RAG retrieval + Ollama SSE streaming
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/                  ← TypeScript Express backend
│   └── src/
│       ├── index.ts          # App entry, middleware setup
│       ├── types/index.ts    # Shared TS types
│       ├── middleware/
│       │   └── auth.ts       # JWT authenticate + requireAdmin
│       ├── routes/
│       │   ├── auth.ts       # /api/auth/*
│       │   ├── chat.ts       # /api/chat/* (proxies SSE from Python)
│       │   └── documents.ts  # /api/documents/* (upload → ragClient)
│       └── services/
│           ├── authService.ts   # bcrypt + JWT
│           └── ragClient.ts     # HTTP proxy to rag-service
│
├── frontend/                 ← React TypeScript SPA
│   └── src/
│       ├── App.tsx
│       ├── lib/api.ts        # API client + SSE streaming
│       ├── hooks/useAuth.tsx
│       ├── components/       # Sidebar, MessageBubble, SourceCitations
│       └── pages/            # Login, Chat, Documents, Users
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Reference

### Auth  (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | — | Get JWT |
| GET | `/me` | Bearer | Current user info |
| POST | `/register` | Admin | Create user |
| GET | `/users` | Admin | List all users |

### Documents  (`/api/documents`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List indexed docs |
| POST | `/upload` | Admin | Upload PDF → Python RAG ingest |
| DELETE | `/:id` | Admin | Delete doc + vectors |

### Chat  (`/api/chat`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sessions` | Bearer | List sessions |
| POST | `/sessions` | Bearer | Create session |
| GET | `/sessions/:id` | Bearer | Get session + history |
| DELETE | `/sessions/:id` | Bearer | Delete session |
| POST | `/sessions/:id/message` | Bearer | **SSE stream** |

### Python RAG service  (internal, `:8080`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + model info |
| POST | `/ingest` | PDF base64 → chunk → embed → store |
| DELETE | `/documents/:id` | Delete all vectors for a doc |
| POST | `/query` | Retrieve top-K similar chunks |
| POST | `/chat` | RAG retrieval + Ollama SSE stream |

### SSE Stream Format
```
data: {"type": "sources", "sources": [...]}   ← retrieved chunks (first event)
data: {"type": "token",   "token":   "Hello"} ← LLM tokens
data: {"type": "done"}                         ← stream complete
data: {"type": "error",   "message": "..."}   ← on failure
```

---

## Production Checklist
- [ ] Set a strong `JWT_SECRET` (32+ random characters)
- [ ] Change `ADMIN_PASSWORD`
- [ ] Add TLS via Caddy / Traefik in front of nginx
- [ ] Replace in-memory user/session stores with PostgreSQL + Redis
- [ ] Configure volume backups for `chroma_data` and `uploads_data`
- [ ] Enable Ollama GPU passthrough (uncomment `deploy` block in compose)
- [ ] Set `uvicorn --workers` based on CPU cores in rag-service Dockerfile
