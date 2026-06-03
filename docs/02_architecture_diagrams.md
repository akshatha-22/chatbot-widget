# Architecture Diagrams

Mermaid diagrams aligned with the **running codebase** (`client/` + `backend/app/`). Details: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. System context

```mermaid
flowchart LR
    User[Website visitor]
    Widget[Remi React widget]
    API[FastAPI API]
    Gemini[Google Gemini API]
    OpenAI[OpenAI API optional]
    DB[(SQLite or PostgreSQL)]

    User --> Widget
    Widget -->|HTTPS REST + SSE| API
    API --> Gemini
    API -.->|fallback| OpenAI
    API --> DB
    API --> Disk[Local uploads + FAISS]
```

---

## 2. Frontend component flow

```mermaid
flowchart TB
    App[App.tsx]
    FW[FloatingWidget.tsx]
    CW[ChatbotWidget index.tsx]
    RL[RemiLauncher]
    Auth[WidgetAuthPanel]
    Compact[CompactWidget]
    Expanded[ExpandedWidget]

    App --> FW --> CW
    CW -->|closed| RL
    CW -->|no user| Auth
    CW -->|logged in compact| Compact
    CW -->|logged in expanded| Expanded

    Expanded --> MI[ChatInterface]
    Expanded --> MCL[MobileConversationList]
    Expanded --> MFP[MobileFilesPanel]
    Expanded --> MTB[MobileTabBar]
    Compact --> SS[streamSend.ts]
    Expanded --> SS
    SS --> API[api/chat.ts fetch SSE]
```

**State owner:** `ChatbotWidget/index.tsx` holds `messages`, `files`, `activeConversation`, `conversations`, folder IDs (`starred`, `archived`, `trash` in localStorage).

---

## 3. Backend request layers

```mermaid
flowchart TB
    subgraph Routes["api/v1"]
        A[auth.py]
        C[chat.py]
        F[files.py]
    end

    subgraph Deps["Dependencies"]
        GU[get_current_user JWT]
        DB[get_db Session]
    end

    subgraph Services["services/"]
        AS[auth_service]
        CS[chat_service]
        FP[file_parser_service]
        VS[vector_store_service]
    end

    A --> AS
    C --> CS
    F --> FP
    F --> VS
    F -.->|get_conversation| CS
    CS --> VS
    Routes --> GU
    Routes --> DB
```

---

## 4. Chat message sequence (SSE)

```mermaid
sequenceDiagram
    participant U as User
    participant W as streamSend.ts
    participant API as chat.ts fetch
    participant R as POST .../messages/stream
    participant S as chat_service

    U->>W: Send message
    W->>W: Optimistic user msg + placeholder assistant
    W->>API: POST stream + Bearer token
    API->>R: JSON body content
    R->>S: create_message user
    R->>S: stream_and_save_assistant
    loop chunks
        S-->>API: data: token\n\n
        API-->>W: onChunk
    end
    S->>S: create_message assistant
    S-->>API: data: {"event":"done",...}\n\n
    API-->>W: onDone
```

**Note:** There is no WebSocket; streaming uses **HTTP SSE** (`text/event-stream`).

---

## 5. File upload and embedding

```mermaid
sequenceDiagram
    participant W as FileUploadModal
    participant API as files.ts
    participant R as POST .../files
    participant BG as daemon Thread
    participant E as process_file_embedding

    W->>API: multipart upload
    API->>R: FormData file
    R->>R: Save disk pending commit
    R-->>W: status pending
    R->>BG: BackgroundTasks
    BG->>E: extract_text chunk_and_store
    E->>E: FAISS .index + .chunks
    E->>E: status processed commit
    W->>W: Poll listFiles every 3s
```

---

## 6. RAG at query time

```mermaid
flowchart LR
    Q[User message]
    BF[build_rag_context]
    DB[(uploaded_files processed)]
    FAISS[FAISS search top_k=5]
    P[Gemini prompt DOCUMENT CONTEXT]
    G[Gemini stream]

    Q --> BF
    BF --> DB
    BF --> FAISS
    FAISS --> P
    P --> G
```

---

## 7. LLM fallback chain

```mermaid
flowchart TD
    Start[Assistant reply needed]
    PDF{detect_pdf_request?}
    PDFPath[PDF markdown message]
    Gemini{GEMINI_API_KEY set?}
    GStream[Stream Gemini models + optional Search]
    OpenAI{OPENAI_API_KEY set?}
    OAI[OpenAI chat completion]
    FB[Rule-based fallback + RAG excerpt]

    Start --> PDF
    PDF -->|yes| PDFPath
    PDF -->|no| Gemini
    Gemini -->|yes| GStream
    GStream -->|no output| OpenAI
    Gemini -->|no| OpenAI
    OpenAI -->|yes| OAI
    OpenAI -->|no| FB
    GStream -->|success| Done[Persist message]
    OAI --> Done
    FB --> Done
    PDFPath --> Done
```

---

## 8. Authentication flow

```mermaid
sequenceDiagram
    participant W as WidgetAuthPanel
    participant A as api/auth.ts
    participant R as POST /auth/login
    participant LS as localStorage

    W->>A: email password
    A->>R: JSON credentials
    R-->>A: access_token
    A->>LS: token
    W->>A: GET /auth/me Bearer
    A-->>W: User profile
```

Subsequent requests: Axios interceptor and `fetch` add `Authorization: Bearer <token>`.

---

## 9. Deployment topology (typical)

```mermaid
flowchart LR
    Dev[Developer push main]
    CI[GitHub Actions CI]
    Deploy[Deploy workflow]
    Vercel[Vercel static client]
    Railway[Railway API]
    PG[(PostgreSQL)]

    Dev --> CI --> Deploy
    Deploy --> Vercel
    Dev -->|Railway Git integration| Railway
    Railway --> PG
    Vercel -->|VITE_API_URL HTTPS| Railway
```

Optional scaffold under `docker/kubernetes/` is **not** the primary documented path.

---

## 10. Mobile expanded layout

```mermaid
flowchart TB
    subgraph Mobile["Viewport under 768px"]
        Nav[Header menu back collapse close]
        Tabs[MobileTabBar]
        P1[Chat tab ChatInterface]
        P2[Chats tab MobileConversationList]
        P3[Files tab MobileFilesPanel]
    end

    Nav --> P1
    Nav --> P2
    Nav --> P3
    Tabs --> P1
    Tabs --> P2
    Tabs --> P3
```

Desktop expanded: sidebar + chat + files (`md` / `lg` breakpoints).

---

## 11. Database ER diagram (schema)

SQLAlchemy models in `backend/app/database/db.py`. Tables are created on API startup via `Base.metadata.create_all` in `main.py` (no Alembic migrations in repo). Existing SQLite databases may get PDF columns added by a one-off migration in `main.py` (`has_pdf`, `pdf_content`, `pdf_filename` on `messages`).

**Not stored in the database:** FAISS vector indices and raw upload bytes live on disk under `backend/data/vector_store/` and `backend/data/uploads/`.

```mermaid
erDiagram
    users ||--o{ conversations : "owns (CASCADE)"
    conversations ||--o{ messages : "has (CASCADE)"
    conversations ||--o{ uploaded_files : "has (CASCADE)"

    users {
        int id PK "indexed"
        varchar email UK "255, unique, indexed"
        varchar hashed_password "255, bcrypt"
        boolean is_active "default true"
        datetime created_at "utc default"
    }

    conversations {
        int id PK "indexed"
        varchar title "255, nullable"
        int user_id FK "NOT NULL, ON DELETE CASCADE"
        datetime created_at "utc default"
    }

    messages {
        int id PK "indexed"
        int conversation_id FK "NOT NULL, ON DELETE CASCADE"
        varchar role "50, user or assistant"
        text content "NOT NULL"
        boolean has_pdf "default false"
        text pdf_content "nullable"
        varchar pdf_filename "255, nullable"
        datetime created_at "utc default"
    }

    uploaded_files {
        varchar id PK "255, UUID string"
        int conversation_id FK "NOT NULL, ON DELETE CASCADE"
        varchar filename "255"
        varchar file_path "500, disk path"
        varchar status "50, pending | processed | failed"
        datetime created_at "utc default"
    }
```

### Relationship summary

| Parent | Child | FK | On delete | ORM cascade |
|--------|-------|-----|-----------|-------------|
| `users` | `conversations` | `conversations.user_id` | **CASCADE** | `all, delete-orphan` on `User.conversations` |
| `conversations` | `messages` | `messages.conversation_id` | **CASCADE** | `all, delete-orphan` on `Conversation.messages` |
| `conversations` | `uploaded_files` | `uploaded_files.conversation_id` | **CASCADE** | `all, delete-orphan` on `Conversation.files` |

Deleting a **user** removes all their conversations, messages, and uploaded file rows. Deleting a **conversation** removes its messages and file rows (disk files under `backend/data/uploads/` are not automatically purged by the ORM).

### Client-only data (not in ER diagram)

| Data | Storage |
|------|---------|
| JWT session token | `localStorage` (`token`) |
| Starred conversation IDs | `localStorage` (`starredStorage.ts`) |
| Archived / Trash folder IDs | `localStorage` (`conversationFoldersStorage.ts`) |

Column-level reference: [ARCHITECTURE.md §7](./ARCHITECTURE.md#7-database-schema).

---

## Diagram legend

| Symbol | Meaning |
|--------|---------|
| Solid arrow | Implemented today |
| Dotted arrow | Optional / fallback path |
| No Redis / RabbitMQ / LangChain | Not in runtime code |
