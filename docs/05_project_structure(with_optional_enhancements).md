# 05_project_structure(with_optional_enhancements)

This document outlines the complete project structure for the AI Chatbot Widget system, including all directories, files, and their purposes. It also includes optional enhancement directories for advanced reasoning, safety pipelines, and distributed systems.

---

## 1. Root Level Directory Structure

```
chatbot-widget/
├── backend/                          # FastAPI backend application
├── client/                         # React widget frontend
├── docs/                             # Documentation files
├── docker/                           # Docker configuration files
├── scripts/                          # Utility scripts
├── tests/                            # Test files
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── docker-compose.yml                # Docker Compose configuration
├── docker-compose.distributed.yml    # (OPTIONAL) Distributed compose
├── README.md                         # Project README
├── LICENSE                           # License file
└── package.json                      # Root package.json for monorepo
```

---

## 2. Backend Structure (With Optional Enhancements)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                       # FastAPI application entry point
│   ├── config.py                     # Configuration management
│   ├── dependencies.py               # Dependency injection
│   │
│   ├── api/                          # API routes
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py              # Chat endpoints
│   │   │   ├── files.py             # File upload/download endpoints
│   │   │   ├── conversations.py     # Conversation management endpoints
│   │   │   ├── users.py             # User management endpoints
│   │   │   ├── auth.py              # Authentication endpoints
│   │   │   ├── dashboard.py         # Dashboard endpoints
│   │   │   ├── reasoning.py         # (OPTIONAL) Reasoning endpoints
│   │   │   └── safety.py            # (OPTIONAL) Safety check endpoints
│   │   └── health.py                # Health check endpoint
│   │
│   ├── models/                       # Pydantic models for request/response
│   │   ├── __init__.py
│   │   ├── chat.py                  # Chat request/response models
│   │   ├── file.py                  # File models
│   │   ├── conversation.py          # Conversation models
│   │   ├── user.py                  # User models
│   │   ├── reasoning.py             # (OPTIONAL) Reasoning models
│   │   ├── safety.py                # (OPTIONAL) Safety models
│   │   └── common.py                # Common models
│   │
│   ├── schemas/                      # SQLAlchemy database schemas
│   │   ├── __init__.py
│   │   ├── user.py                  # User table schema
│   │   ├── conversation.py          # Conversation table schema
│   │   ├── message.py               # Message table schema
│   │   ├── file.py                  # File table schema
│   │   ├── embedding.py             # Embedding table schema
│   │   ├── reasoning_log.py         # (OPTIONAL) Reasoning logs
│   │   ├── safety_check.py          # (OPTIONAL) Safety check logs
│   │   └── base.py                  # Base schema class
│   │
│   ├── services/                     # Business logic services
│   │   ├── __init__.py
│   │   ├── chat_service.py          # Chat processing logic
│   │   ├── file_service.py          # File processing logic
│   │   ├── conversation_service.py  # Conversation management
│   │   ├── user_service.py          # User management
│   │   ├── auth_service.py          # Authentication logic
│   │   ├── llm_service.py           # LLM orchestration
│   │   ├── embedding_service.py     # Embedding generation
│   │   ├── vector_store_service.py  # Vector store management
│   │   ├── file_parser_service.py   # File parsing logic
│   │   ├── reasoning_service.py     # (OPTIONAL) Reasoning service
│   │   └── safety_service.py        # (OPTIONAL) Safety service
│   │
│   ├── core/                         # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py              # JWT and security utilities
│   │   ├── logger.py                # Logging configuration
│   │   ├── exceptions.py            # Custom exceptions
│   │   └── constants.py             # Application constants
│   │
│   ├── middleware/                   # Custom middleware
│   │   ├── __init__.py
│   │   ├── auth.py                  # Authentication middleware
│   │   ├── cors.py                  # CORS configuration
│   │   ├── error_handler.py         # Error handling middleware
│   │   ├── request_logger.py        # Request logging middleware
│   │   ├── safety_middleware.py     # (OPTIONAL) Safety middleware
│   │   └── rate_limiter.py          # Rate limiting middleware
│   │
│   ├── utils/                        # Utility functions
│   │   ├── __init__.py
│   │   ├── validators.py            # Input validators
│   │   ├── formatters.py            # Response formatters
│   │   ├── file_utils.py            # File handling utilities
│   │   └── text_utils.py            # Text processing utilities
│   │
│   ├── database/                     # Database configuration
│   │   ├── __init__.py
│   │   ├── db.py                    # Database connection
│   │   ├── session.py               # Session management
│   │   └── migrations/              # Alembic migrations
│   │       ├── versions/
│   │       │   ├── 001_initial.py
│   │       │   ├── 002_add_embeddings.py
│   │       │   ├── 003_add_reasoning_logs.py      # (OPTIONAL)
│   │       │   ├── 004_add_safety_checks.py       # (OPTIONAL)
│   │       │   └── ...
│   │       ├── env.py
│   │       ├── script.py.mako
│   │       └── alembic.ini
│   │
│   ├── llm/                          # LLM integration
│   │   ├── __init__.py
│   │   ├── providers/               # LLM provider implementations
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Base provider class
│   │   │   ├── openai_provider.py   # OpenAI implementation
│   │   │   ├── anthropic_provider.py # Anthropic implementation
│   │   │   ├── google_provider.py   # Google Gemini implementation
│   │   │   └── deepseek_provider.py # DeepSeek implementation
│   │   │
│   │   ├── embeddings/              # Embedding implementations
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Base embedding class
│   │   │   ├── openai_embeddings.py
│   │   │   ├── cohere_embeddings.py
│   │   │   └── google_embeddings.py
│   │   │
│   │   ├── chains/                  # LangChain chains
│   │   │   ├── __init__.py
│   │   │   ├── rag_chain.py         # RAG chain implementation
│   │   │   ├── qa_chain.py          # Q&A chain
│   │   │   └── summarization_chain.py # Summarization chain
│   │   │
│   │   └── reasoning/               # (OPTIONAL) Advanced reasoning
│   │       ├── __init__.py
│   │       ├── chain_of_thought.py  # Chain-of-thought implementation
│   │       ├── reasoning_engine.py  # Multi-step reasoning
│   │       ├── prompts.py           # Reasoning prompt templates
│   │       └── tests/
│   │           ├── test_chain_of_thought.py
│   │           └── test_reasoning_engine.py
│   │
│   ├── safety/                       # (OPTIONAL) Advanced safety pipelines
│   │   ├── __init__.py
│   │   ├── content_moderation.py    # Content moderation logic
│   │   ├── toxicity_detector.py     # Toxicity detection
│   │   ├── bias_detector.py         # Bias detection
│   │   ├── jailbreak_detector.py    # Jailbreak attempt detection
│   │   ├── filters.py               # Content filtering utilities
│   │   └── tests/
│   │       ├── test_content_moderation.py
│   │       ├── test_toxicity_detector.py
│   │       └── test_bias_detector.py
│   │
│   └── distributed/                 # (OPTIONAL) Distributed AI systems
│       ├── __init__.py
│       ├── cache_manager.py         # Redis distributed caching
│       ├── queue_manager.py         # Task queue management
│       ├── load_balancer.py         # Load balancing logic
│       └── kubernetes_config.py     # Kubernetes configuration
│
├── tests/                            # Backend tests
│   ├── __init__.py
│   ├── conftest.py                  # Pytest configuration
│   ├── unit/
│   │   ├── test_chat_service.py
│   │   ├── test_file_service.py
│   │   ├── test_llm_service.py
│   │   ├── test_reasoning_service.py      # (OPTIONAL)
│   │   ├── test_safety_service.py         # (OPTIONAL)
│   │   └── ...
│   ├── integration/
│   │   ├── test_chat_api.py
│   │   ├── test_file_upload.py
│   │   ├── test_reasoning_api.py          # (OPTIONAL)
│   │   ├── test_safety_api.py             # (OPTIONAL)
│   │   └── ...
│   └── fixtures/
│       ├── sample_files/
│       └── mock_data.py
│
├── requirements.txt                  # Core Python dependencies
├── requirements-optional.txt         # (OPTIONAL) Optional dependencies
├── .env.example                      # Environment variables template
├── Dockerfile                        # Docker configuration
├── .dockerignore                     # Docker ignore rules
├── pytest.ini                        # Pytest configuration
├── pyproject.toml                    # Python project configuration
└── README.md                         # Backend README
```

---

## 3. Frontend Structure (With Optional Enhancements)

```
client/
├── public/                           # Static assets
│   ├── index.html                   # Main HTML file
│   ├── favicon.ico                  # Favicon
│   └── manifest.json                # PWA manifest
│
├── src/
│   ├── index.tsx                    # React entry point
│   ├── App.tsx                      # Root component
│   │
│   ├── components/                  # Reusable components
│   │   ├── ChatWidget/
│   │   │   ├── ChatWidget.tsx       # Main widget component
│   │   │   ├── ChatWidget.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── ChatWindow/
│   │   │   ├── ChatWindow.tsx       # Chat display component
│   │   │   ├── ChatWindow.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── MessageBubble/
│   │   │   ├── MessageBubble.tsx    # Individual message component
│   │   │   ├── MessageBubble.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── MessageInput/
│   │   │   ├── MessageInput.tsx     # Message input with edit feature
│   │   │   ├── MessageInput.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── FileUpload/
│   │   │   ├── FileUpload.tsx       # File upload component
│   │   │   ├── FileUpload.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── FilePreview/
│   │   │   ├── FilePreview.tsx      # File preview component
│   │   │   ├── FilePreview.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── TypingIndicator/
│   │   │   ├── TypingIndicator.tsx  # Loading animation
│   │   │   ├── TypingIndicator.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── SettingsPanel/
│   │   │   ├── SettingsPanel.tsx    # Settings/configuration
│   │   │   ├── SettingsPanel.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── ReasoningDisplay/        # (OPTIONAL) Advanced reasoning UI
│   │   │   ├── ReasoningDisplay.tsx  # Display chain-of-thought
│   │   │   ├── StepByStep.tsx        # Step-by-step reasoning view
│   │   │   ├── ReasoningDisplay.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── SafetyIndicator/         # (OPTIONAL) Safety indicators
│   │   │   ├── SafetyIndicator.tsx   # Show content safety status
│   │   │   ├── SafetyIndicator.module.css
│   │   │   └── index.ts
│   │   │
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Spinner.tsx
│   │       ├── Toast.tsx
│   │       └── index.ts
│   │
│   ├── pages/                       # Page components
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx        # Conversation dashboard
│   │   │   ├── Dashboard.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── ConversationDetail/
│   │   │   ├── ConversationDetail.tsx
│   │   │   ├── ConversationDetail.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── Auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Auth.module.css
│   │   │   └── index.ts
│   │   │
│   │   └── NotFound/
│   │       ├── NotFound.tsx
│   │       └── index.ts
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useChat.ts               # Chat logic hook
│   │   ├── useFileUpload.ts         # File upload hook
│   │   ├── useConversations.ts      # Conversations management hook
│   │   ├── useAuth.ts               # Authentication hook
│   │   ├── useFetch.ts              # Fetch wrapper hook
│   │   ├── useReasoning.ts          # (OPTIONAL) Reasoning hook
│   │   ├── useSafety.ts             # (OPTIONAL) Safety check hook
│   │   └── index.ts
│   │
│   ├── services/                    # API services
│   │   ├── api.ts                   # API client configuration
│   │   ├── chatService.ts           # Chat API calls
│   │   ├── fileService.ts           # File API calls
│   │   ├── conversationService.ts   # Conversation API calls
│   │   ├── authService.ts           # Auth API calls
│   │   ├── reasoningService.ts      # (OPTIONAL) Reasoning API calls
│   │   ├── safetyService.ts         # (OPTIONAL) Safety check API calls
│   │   └── index.ts
│   │
│   ├── store/                       # State management (Zustand)
│   │   ├── chatStore.ts             # Chat state
│   │   ├── conversationStore.ts     # Conversation state
│   │   ├── authStore.ts             # Auth state
│   │   ├── uiStore.ts               # UI state
│   │   ├── reasoningStore.ts        # (OPTIONAL) Reasoning state
│   │   ├── safetyStore.ts           # (OPTIONAL) Safety state
│   │   └── index.ts
│   │
│   ├── types/                       # TypeScript types
│   │   ├── chat.ts                  # Chat types
│   │   ├── conversation.ts          # Conversation types
│   │   ├── file.ts                  # File types
│   │   ├── user.ts                  # User types
│   │   ├── api.ts                   # API types
│   │   ├── reasoning.ts             # (OPTIONAL) Reasoning types
│   │   ├── safety.ts                # (OPTIONAL) Safety types
│   │   └── index.ts
│   │
│   ├── utils/                       # Utility functions
│   │   ├── formatters.ts            # Data formatters
│   │   ├── validators.ts            # Input validators
│   │   ├── dateUtils.ts             # Date utilities
│   │   ├── storageUtils.ts          # Local storage utilities
│   │   └── index.ts
│   │
│   ├── styles/                      # Global styles
│   │   ├── global.css               # Global CSS
│   │   ├── variables.css            # CSS variables
│   │   ├── themes.css               # Theme definitions
│   │   └── responsive.css           # Responsive utilities
│   │
│   ├── config/                      # Configuration
│   │   ├── api.config.ts            # API configuration
│   │   ├── app.config.ts            # App configuration
│   │   └── constants.ts             # App constants
│   │
│   └── assets/                      # Static assets
│       ├── icons/
│       ├── images/
│       └── fonts/
│
├── tests/                           # Frontend tests
│   ├── unit/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   ├── integration/
│   └── e2e/
│
├── .env.example                     # Environment variables template
├── .eslintrc.json                   # ESLint configuration
├── .prettierrc                      # Prettier configuration
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
├── package.json                     # NPM dependencies
├── package-lock.json                # Dependency lock file
├── Dockerfile                       # Docker configuration
├── .dockerignore                    # Docker ignore rules
└── README.md                        # Frontend README
```

---

## 4. Documentation Structure (With Optional Enhancements)

```
docs/
├── 01_system_overview.md            # System architecture and overview
├── 02_architecture_diagrams.md      # Architecture diagrams
├── 03_features_capabilities.md      # Feature specifications
├── 04_ml_ai_concepts.md             # ML/AI concepts
├── 05_project_structure.md          # Project structure
├── 06_api_documentation.md          # API endpoint documentation
├── 07_deployment_guide.md           # Deployment instructions
├── 08_development_guide.md          # Development setup and guidelines
├── 09_testing_strategy.md           # Testing approach
├── 10_security_guide.md             # Security best practices
├── 11_troubleshooting.md            # Common issues and solutions
├── 12_faq.md                        # Frequently asked questions
├── 13_optional_enhancements.md      # Optional features guide
├── 14_reasoning_guide.md            # (OPTIONAL) Advanced reasoning setup
├── 15_safety_pipeline_guide.md      # (OPTIONAL) Safety pipeline setup
├── 16_distributed_systems_guide.md  # (OPTIONAL) Distributed deployment
└── images/                          # Documentation images
    ├── architecture.png
    ├── workflow.png
    ├── reasoning_flow.png           # (OPTIONAL)
    ├── safety_pipeline.png          # (OPTIONAL)
    └── ...
```

---

## 5. Docker Structure (With Optional Enhancements)

```
docker/
├── backend.Dockerfile              # Backend Docker image
├── client.Dockerfile             # Widget static build (Vite → nginx)
├── nginx.Dockerfile                # Nginx reverse proxy
├── postgres.Dockerfile             # PostgreSQL database
├── redis.Dockerfile                # (OPTIONAL) Redis cache
├── nginx.conf                       # Nginx configuration
├── entrypoint.sh                    # Container entry script
└── kubernetes/                      # (OPTIONAL) Kubernetes configs
    ├── backend-deployment.yaml      # Backend deployment
    ├── client-deployment.yaml     # Frontend deployment
    ├── redis-deployment.yaml        # Redis deployment
    ├── postgres-deployment.yaml     # PostgreSQL deployment
    ├── service.yaml                 # Service configuration
    ├── ingress.yaml                 # Ingress configuration
    └── configmap.yaml               # ConfigMap for settings
```

---

## 6. Scripts Structure (With Optional Enhancements)

```
scripts/
├── setup.sh                         # Initial setup script
├── dev.sh                           # Development startup script
├── test.sh                          # Run tests
├── build.sh                         # Build for production
├── deploy.sh                        # Deployment script
├── migrate.sh                       # Database migration script
├── seed.sh                          # Seed database with sample data
├── cleanup.sh                       # Cleanup script
├── setup-reasoning.sh               # (OPTIONAL) Setup reasoning engine
├── setup-safety.sh                  # (OPTIONAL) Setup safety pipeline
├── setup-distributed.sh             # (OPTIONAL) Setup Kubernetes
└── setup-redis.sh                   # (OPTIONAL) Setup Redis cache
```

---

## 7. Configuration Files at Root

```
.env.example                         # Environment variables template
.gitignore                           # Git ignore rules
.dockerignore                        # Docker ignore rules
docker-compose.yml                   # Docker Compose configuration
docker-compose.distributed.yml       # (OPTIONAL) Distributed Docker Compose
docker-compose.prod.yml              # Production Docker Compose
.github/
├── workflows/
│   ├── ci.yml                       # CI/CD pipeline
│   ├── tests.yml                    # Test pipeline
│   └── deploy.yml                   # Deployment pipeline
README.md                            # Project README
LICENSE                              # License file
CONTRIBUTING.md                      # Contribution guidelines
```

---

## 8. Key Files Summary

### Backend Key Files

| File | Purpose |
| --- | --- |
| `main.py` | FastAPI application entry point |
| `config.py` | Configuration management |
| `dependencies.py` | Dependency injection setup |
| `chat_service.py` | Chat processing logic |
| `llm_service.py` | LLM orchestration |
| `vector_store_service.py` | Vector store management |
| `auth_service.py` | Authentication logic |
| `reasoning_service.py` | (OPTIONAL) Reasoning service |
| `safety_service.py` | (OPTIONAL) Safety service |

### Frontend Key Files

| File | Purpose |
| --- | --- |
| `App.tsx` | Root React component |
| `ChatWidget.tsx` | Main widget component |
| `MessageInput.tsx` | Message input with edit feature |
| `chatStore.ts` | Chat state management |
| `chatService.ts` | API communication |
| `useChat.ts` | Chat logic hook |
| `ReasoningDisplay.tsx` | (OPTIONAL) Reasoning UI |
| `SafetyIndicator.tsx` | (OPTIONAL) Safety UI |

### Configuration Files

| File | Purpose |
| --- | --- |
| `.env.example` | Environment variables template |
| `docker-compose.yml` | Local development setup |
| `docker-compose.distributed.yml` | (OPTIONAL) Distributed setup |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Frontend build configuration |
| `pyproject.toml` | Backend project configuration |
| `requirements-optional.txt` | (OPTIONAL) Optional dependencies |
| `kubernetes/` | (OPTIONAL) Kubernetes deployment configs |

---

## 9. Optional Enhancements Integration Points

### When to Add Optional Features

| Enhancement | When to Add | Priority |
| --- | --- | --- |
| **Advanced Reasoning** | Complex problem-solving needed | Medium |
| **Safety Pipelines** | High-risk applications | High |
| **Distributed Systems** | 1000+ concurrent users | Medium |

### Dependency Management for Optional Features

```
requirements.txt              # Core dependencies
requirements-optional.txt     # Optional dependencies
  - transformers (for safety)
  - redis (for distributed)
  - celery (for task queue)
  - kubernetes (for k8s)
```

### Environment Variables for Optional Features

```bash
# .env

# Core
DATABASE_URL=postgresql://...
GOOGLE_API_KEY=...

# Optional: Advanced Reasoning
ENABLE_REASONING=false
REASONING_MODEL=gemini-2.5-flash

# Optional: Safety Pipelines
ENABLE_SAFETY=false
TOXICITY_MODEL=cardiffnlp/twitter-roberta-base-hate
PROFANITY_FILTER_ENABLED=false

# Optional: Distributed Systems
ENABLE_DISTRIBUTED=false
REDIS_URL=redis://localhost:6379
KUBERNETES_ENABLED=false
CELERY_BROKER_URL=redis://localhost:6379/0
```

---

## 10. Development Workflow

### Directory Navigation

```bash
# Backend development
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
pip install -r requirements-optional.txt  # For optional features

# Frontend development
cd client
npm install
npm start

# Run tests
npm test                    # Frontend tests
pytest                      # Backend tests

# Database migrations
alembic upgrade head        # Apply migrations
alembic downgrade -1        # Rollback last migration

# Optional: Setup reasoning
bash scripts/setup-reasoning.sh

# Optional: Setup safety
bash scripts/setup-safety.sh

# Optional: Setup distributed
bash scripts/setup-distributed.sh
```

---

## 11. File Organization Best Practices

1. **Services**: All business logic goes in the `services/` directory

1. **Models**: Request/response schemas in `models/`, database schemas in `schemas/`

1. **Components**: Reusable UI components in `components/`, page-level components in `pages/`

1. **Hooks**: Custom React hooks in `hooks/`, organized by functionality

1. **Utilities**: Helper functions in `utils/`, organized by domain

1. **Tests**: Mirror the source structure with corresponding test files

1. **Optional Features**: Keep in separate subdirectories (`reasoning/`, `safety/`, `distributed/`)

---

## 12. Naming Conventions

### Backend

- **Files**: `snake_case.py`

- **Classes**: `PascalCase`

- **Functions**: `snake_case()`

- **Constants**: `UPPER_SNAKE_CASE`

### Frontend

- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities

- **Components**: `PascalCase`

- **Functions**: `camelCase()`

- **Constants**: `UPPER_SNAKE_CASE`

- **Types**: `PascalCase` with `T` prefix (e.g., `TMessage`)

---

## 13. Import Organization

### Backend

```python
# Standard library
import os
import sys

# Third-party
from fastapi import FastAPI
from sqlalchemy import create_engine

# Optional dependencies
from transformers import pipeline  # Only if ENABLE_SAFETY=true
import redis  # Only if ENABLE_DISTRIBUTED=true

# Local
from app.services import chat_service
from app.models import ChatRequest
```

### Frontend

```typescript
// React and third-party
import React, { useState } from 'react';
import axios from 'axios';

// Local components
import ChatWidget from '@/components/ChatWidget';

// Optional components
import ReasoningDisplay from '@/components/ReasoningDisplay'; // Optional
import SafetyIndicator from '@/components/SafetyIndicator'; // Optional

// Local utilities
import { formatDate } from '@/utils/dateUtils';

// Types
import type { TMessage } from '@/types/chat';

// Styles
import styles from './App.module.css';
```

---

## Conclusion

This project structure provides a scalable, maintainable foundation for the chatbot widget system. It follows industry best practices for both backend (FastAPI) and frontend (React) development, with clear separation of concerns and organized file placement for easy navigation and collaboration.

The structure also accommodates optional enhancements for advanced reasoning, safety pipelines, and distributed systems, allowing you to extend the system as requirements grow without disrupting the core architecture.

### Quick Reference for Optional Enhancements

- **Advanced Reasoning**: Add when complex problem-solving is needed

- **Safety Pipelines**: Add for high-risk applications or compliance requirements

- **Distributed Systems**: Add when scaling to 1000+ concurrent users

Each enhancement is designed to be modular and can be added independently without affecting the core functionality.

