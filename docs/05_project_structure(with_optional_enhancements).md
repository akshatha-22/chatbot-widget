# Project Structure

Directory layout for the **chatbot-widget** monorepo as it exists today. Optional scaffold under `docker/` and `scripts/` is listed separately — those paths are **not** imported by the running app.

**Deep dive:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Root layout

```
chatbot-widget/
├── client/                 # React + Vite frontend (NOT "frontend/")
├── backend/                # FastAPI application
├── docs/                   # Documentation (this folder)
├── docker/                 # Optional K8s/Docker scaffold (not required to run)
├── scripts/                # Setup helpers; some are optional-experiment only
├── .github/workflows/      # ci.yml, deploy.yml
├── package.json            # npm workspace root (client package; backend is Python-only)
├── package-lock.json
├── .env.example            # Template → copy to .env.local at repo root
├── vercel.json             # Vercel monorepo build (root)
├── .vercelignore
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

**Not present at root:** `frontend/`, root-level `tests/` (tests live in `backend/tests/`).

---

## Frontend (`client/`)

```
client/
├── index.html
├── embed-demo.html         # Local embed bundle demo
├── package.json            # remi-widget (npm publish from client/)
├── vite.config.ts          # App build + lib mode (build:lib)
├── tailwind.config.js
├── tailwind.config.embed.js
├── postcss.config.js
├── postcss.config.embed.js
├── tsconfig.json
├── scripts/verify-publish.sh
├── dist-lib/               # build:lib output (remi-widget.js) — published to npm
├── vercel.json             # Optional; deploy from repo root uses root vercel.json
├── tests/unit/embed.test.ts
├── public/
└── src/
    ├── main.tsx            # Dev app entry
    ├── embed.tsx           # IIFE entry → window.RemiWidget
    ├── embed/mount.ts      # mount / unmount controller
    ├── App.tsx             # Renders FloatingWidget only
    ├── vite-env.d.ts
    ├── api/
    │   ├── client.ts       # Axios + auth interceptor
    │   ├── config.ts       # setApiBaseUrl / getApiBaseUrl (embed + dev)
    │   ├── auth.ts
    │   ├── chat.ts         # fetch SSE streamMessage + REST
    │   ├── files.ts        # multipart upload, deleteFile(), error parsing
    │   └── rateLimit.ts    # 429 RateLimitError + retry_after
    ├── constants/
    │   └── uploadFormats.ts
    ├── components/
    │   ├── ChatbotWidget/
    │   │   ├── WidgetThemeContext.tsx
    │   │   ├── index.tsx           # State owner, routing
    │   │   ├── FloatingWidget.tsx  # Re-export entry
    │   │   ├── RemiLauncher.tsx
    │   │   ├── RemiSphere.tsx      # Framer Motion launcher
    │   │   ├── RemiAvatar2D.tsx
    │   │   ├── WidgetAuthPanel.tsx
    │   │   ├── CompactWidget.tsx
    │   │   ├── ExpandedWidget.tsx
    │   │   ├── ChatInterface.tsx
    │   │   ├── streamSend.ts
    │   │   ├── MessageEditModal.tsx
    │   │   ├── FileUploadModal.tsx
    │   │   ├── FileListItem.tsx      # File row + inline delete confirm
    │   │   ├── FileGenerationPanel.tsx
    │   │   ├── WidgetConversationDashboard.tsx
    │   │   ├── MobileTabBar.tsx
    │   │   ├── MobileConversationList.tsx
    │   │   ├── MobileFilesPanel.tsx
    │   │   ├── NavTooltip.tsx
    │   │   ├── RateLimitBanner.tsx
    │   │   ├── RemiFace.tsx
    │   │   └── AssistantMarkdown.tsx
    │   └── SearchFilterPanel.tsx
    ├── hooks/
    │   └── useIsMobile.ts
    ├── styles/
    │   ├── index.css
    │   ├── embed.css           # Scoped Tailwind for script-tag embed
    │   └── animations.css
    ├── types/
    │   └── index.ts
    └── utils/
        ├── widgetPosition.ts
        ├── pdfGenerator.ts
        ├── exportConversation.ts
        ├── downloadFile.ts
        ├── starredStorage.ts
        ├── conversationFoldersStorage.ts
        └── generatedFilesStorage.ts
```

### Intentionally absent

- `pages/`, React Router — single-page widget only  
- `store/` (Zustand/Redux) — React `useState` in `index.tsx`  
- `services/` folder — API lives in `src/api/`  

---

## Backend (`backend/`)

```
backend/
├── app/
│   ├── main.py             # FastAPI app, CORS, security headers, migrations
│   ├── config.py           # SECRET_KEY, quota, cache settings
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── chat.py     # Active chat routes
│   │   │   ├── files.py    # upload, list, delete
│   │   │   └── admin.py    # embedding-health
│   │   ├── auth.py         # Legacy/unused — prefer api/v1
│   │   ├── chat.py         # Legacy/unused — prefer api/v1
│   │   └── conversations.py
│   ├── core/
│   │   ├── security.py     # bcrypt + JWT (python-jose)
│   │   ├── network.py      # get_real_ip(), Cloudflare IP trust
│   │   ├── mime_validation.py  # magic-byte MIME check
│   │   └── sanitizer.py    # prompt-injection stripping
│   ├── middleware/
│   │   └── security_headers.py
│   ├── database/
│   │   ├── db.py           # SQLAlchemy models + SessionLocal
│   │   └── migrations/     # startup.py + Alembic versions/
│   ├── schemas/            # Pydantic request/response models
│   │   ├── user.py
│   │   ├── conversation.py
│   │   ├── message.py
│   │   ├── file.py
│   │   └── audit_log.py
│   └── services/
│       ├── auth_service.py
│       ├── auth_rate_limit_service.py
│       ├── audit_service.py
│       ├── chat_service.py       # LLM, RAG, SSE, quota, sanitization
│       ├── quota_service.py
│       ├── response_cache.py     # per-user TTLCache
│       ├── vector_store_service.py  # Gemini embed + pgvector + page retrieval
│       └── file_parser_service.py
├── tests/                  # 105 pytest tests
│   ├── test_api_*.py
│   ├── test_security_features.py
│   ├── test_network.py
│   ├── conftest.py
│   └── unit/               # sanitizer, cache, MIME, quota, audit, file delete, …
├── data/                   # Runtime (gitignored): uploads + vector_store
├── Dockerfile              # Railway/production image
├── railway.toml
├── requirements.txt
├── requirements-docker.txt
├── requirements-ci.txt
├── pytest.ini
├── alembic.ini             # Optional; startup.py + create_all on boot
└── README.md
```

### Intentionally absent in `backend/app/`

- `langchain/`, `llm/`, `chains/`  
- `models/` ORM package — models are in `database/db.py`  
- `conversation_service.py` — logic is in `chat_service.py`  
- Redis/Celery workers  

---

## Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Code-level reference (source of truth for implementation) |
| `01_system_overview.md` | Product + system summary |
| `02_architecture_diagrams.md` | Mermaid diagrams |
| `03_features_capabilities.md` | Shipped vs not shipped |
| `04_ml_ai_concepts.md` | RAG/LLM concepts |
| `05_project_structure(...).md` | This file |
| `06_Epics_User_stories_and_Use_cases.md` | Epics, user stories, use cases |
| `07_deployment_guide.md` | Local + production deploy (live URLs) |
| `08_frontend_guide.md` | React, TypeScript, widget frontend |
| `09_known_limitations.md` | Known limitations (quota vs architecture) & future work |
| `10_embedding_guide.md` | Script-tag embed (`remi-widget` on npm + jsDelivr) |

**Not yet in codebase:** Conversation Detail tabbed view.

---

## CI/CD (`.github/workflows/`)

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | Push/PR `main`, `develop` | Backend pytest; frontend type-check + build + `build:lib` + vitest |
| `deploy.yml` | After CI on `main` or manual | Vercel production (backend deploys on Railway separately) |

---

## Optional scaffold (not runtime)

These directories support **experiments** or future ops — the app does not import them:

```
docker/
├── backend.Dockerfile
├── frontend.Dockerfile
├── kubernetes/           # Deployment YAML samples
├── nginx.conf
└── ...

scripts/
├── setup.sh
├── dev.sh
├── test.sh
├── setup-redis.sh        # No Redis in app code
├── setup-reasoning.sh
├── setup-safety.sh
└── setup-distributed.sh

docker-compose.yml          # Empty at root
docker-compose.prod.yml     # Empty at root
docker-compose.distributed.yml
```

---

## Configuration files

| File | Read by |
|------|---------|
| `.env.local` (repo root) | `backend/app/config.py`, Vite `envDir: '..'` |
| `SECRET_KEY` | **Required** JWT signing (min 32 chars; not `JWT_SECRET_KEY`) |
| `ENVIRONMENT` | `development` / `production` (HSTS when production) |
| `GEMINI_API_KEY` | Primary LLM |
| `GEMINI_DAILY_QUOTA_PER_USER` | Daily Gemini calls per user (default 100) |
| `RESPONSE_CACHE_*` | TTL response cache settings |
| `AUTH_RATE_LIMIT_*` | Login/signup brute-force protection |
| `CLOUDFLARE_ONLY` | Trust only Cloudflare origin IPs for `CF-Connecting-IP` |
| `DATABASE_URL` | SQLAlchemy |
| `CORS_ORIGINS` | FastAPI CORS |
| `VITE_API_URL` | Frontend API base (build time) |

Variables in `.env.example` such as `REDIS_URL`, `VITE_WS_URL`, `JWT_SECRET_KEY` are **not read** by application code.

---

## Development workflow

```bash
# From repo root
cp .env.example .env.local

# Terminal 1 — API
cd backend
python -m venv venv && source venv/bin/activate  # or Windows equivalent
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Widget
npm ci
npm run dev    # runs client dev server (port 5173)
```

```bash
# Tests
cd backend && pytest
npm run type-check
```

---

## Naming conventions (actual)

| Area | Convention |
|------|------------|
| React components | PascalCase `.tsx` |
| API modules | `api/v1/<domain>.py` |
| Services | `<domain>_service.py` |
| DB tables | plural snake_case (`users`, `conversations`) |
| Conversation ID | Integer in API (stringified in frontend types) |
| File ID | UUID string |

---

## Related

- [README.md](../README.md) — quick start  
- [07_deployment_guide.md](./07_deployment_guide.md) — production  
- [09_known_limitations.md](./09_known_limitations.md) — known limitations & future work
- [08_frontend_guide.md](./08_frontend_guide.md) — React/TypeScript frontend reference  
