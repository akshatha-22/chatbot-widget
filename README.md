# AI Chatbot Widget - Comprehensive Documentation

A production-ready, feature-rich chatbot widget system that combines general-purpose AI assistance with advanced document analysis capabilities. This is a complete guide to understanding, building, and deploying the chatbot widget.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Architecture & Design](#architecture--design)
4. [Features & Capabilities](#features--capabilities)
5. [System Design Concepts](#system-design-concepts)
6. [Technology Stack](#technology-stack)
7. [LLM Model Selection](#llm-model-selection)
8. [Project Structure](#project-structure)
9. [Optional Enhancements](#optional-enhancements)
10. [Setup & Installation](#setup--installation)
11. [API Documentation](#api-documentation)
12. [Deployment](#deployment)
13. [Security & Best Practices](#security--best-practices)
14. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 16+** (for frontend)
- **Docker** (optional, for containerization)
- **Google API Key** (for Gemini 2.5 Flash)

### 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/chatbot-widget.git
cd chatbot-widget

# 2. Configure environment (repo root — used by backend + Vite)
cp .env.ex  zdkoample .env.local
# Edit .env.local: GEMINI_API_KEY (and JWT/DB settings as needed)

# 3. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 4. Widget (workspace app under client/)
cd ..
npm install

# 5. Run development servers (from repo root in two terminals)
# Terminal 1 — API
cd backend && python -m uvicorn app.main:app --reload

# Terminal 2 — Vite widget
npm run dev

# 6. Open the app
# http://localhost:5173 (Vite prints the exact URL)
```

---

## Project Overview

### What is the Chatbot Widget?

The **AI Chatbot Widget** is a sophisticated conversational AI system that serves two primary purposes:

1. **General-Purpose AI Assistant**: Answer questions, provide information, and engage in natural conversations
2. **Document-Based AI**: Upload files (PDF, TXT, DOCX, XLSX, Markdown) and ask questions about their content

### Key Characteristics

- **Hybrid Intelligence**: Combines general AI knowledge with document-specific expertise
- **Multi-Provider Support**: Works with Gemini, OpenAI, Claude, and DeepSeek
- **Production-Ready**: Includes security, authentication, and scalability features
- **User-Friendly**: Clean interface with conversation history and file management
- **Extensible**: Optional enhancements for reasoning, safety, and distributed systems

### Core Use Cases

1. **Customer Support**: Answer customer questions using knowledge base documents
2. **Research Assistant**: Analyze academic papers and research documents
3. **Legal Assistant**: Review contracts and legal documents
4. **Financial Analysis**: Analyze financial reports and statements
5. **Educational Tool**: Explain concepts from uploaded course materials
6. **Content Creation**: Generate summaries, outlines, and reports from documents

---

## Architecture & Design

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CHATBOT WIDGET                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Frontend (React Widget)                 │   │
│  │  - Chat interface                                    │   │
│  │  - File upload                                       │   │
│  │  - Message editing                                   │   │
│  │  - Dashboard                                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Backend (FastAPI Server)                   │   │
│  │  - API endpoints                                     │   │
│  │  - Authentication                                    │   │
│  │  - Rate limiting                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Business Logic Services                       │   │
│  │  - Chat service                                      │   │
│  │  - File service                                      │   │
│  │  - Conversation service                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      RAG & Retrieval Components                      │   │
│  │  - Document chunking                                 │   │
│  │  - Embedding generation                              │   │
│  │  - Vector store (FAISS)                              │   │
│  │  - Semantic search                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      LLM Integration Layer                           │   │
│  │  - Multi-model provider abstraction                  │   │
│  │  - Request routing                                   │   │
│  │  - Error handling                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      External LLM APIs (Not Built)                   │   │
│  │  - Google Gemini 2.5 Flash                           │   │
│  │  - OpenAI GPT-4                                      │   │
│  │  - Anthropic Claude                                  │   │
│  │  - DeepSeek V3.2                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Data Layer                                 │   │
│  │  - PostgreSQL database                               │   │
│  │  - FAISS vector store                                │   │
│  │  - File storage (S3)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input
    ↓
Frontend Widget
    ↓
API Request (REST/WebSocket)
    ↓
Backend Server
    ↓
Authentication & Validation
    ↓
Service Layer Processing
    ↓
For Document Queries:
    ├→ Document Chunking
    ├→ Embedding Generation
    ├→ FAISS Vector Search
    └→ Context Retrieval
    ↓
LLM Provider Selection
    ↓
Prompt Construction
    ↓
LLM API Call
    ↓
Response Processing
    ↓
Database Storage
    ↓
Frontend Display
    ↓
User Sees Response
```

### Workflow: Chat with File

```
1. User uploads file (PDF, DOCX, TXT, etc.)
   ↓
2. Backend receives file
   ↓
3. File parsing and text extraction
   ↓
4. Text chunking (1000 tokens with 100 token overlap)
   ↓
5. Embedding generation for each chunk
   ↓
6. Store embeddings in FAISS vector store
   ↓
7. User asks question about the file
   ↓
8. Query embedding generated
   ↓
9. FAISS semantic search for top-5 relevant chunks
   ↓
10. Augment user query with retrieved context
   ↓
11. Send to LLM with context
   ↓
12. LLM generates grounded response
   ↓
13. Response displayed to user
   ↓
14. Conversation saved to database
```

---

## Features & Capabilities

### 1. Core Chat Features

#### Real-Time Conversational Interface
- Responsive chat bubbles with timestamps
- Auto-scrolling to latest message
- Typing indicators when assistant is generating response
- Support for multi-line messages
- Copy-to-clipboard functionality

#### Message Editing Feature
- Edit messages before sending
- Inline message editing
- Character count display
- Real-time validation
- Undo/Redo functionality (optional)

#### Conversation Context Management
- Automatic context window management
- Conversation history stored in database
- Context summarization for long conversations
- Ability to start new or continue existing conversations

#### Multiple Conversation Sessions
- Create new conversations with custom titles
- Switch between conversations seamlessly
- Maintain separate context for each
- Archive or delete conversations

### 2. File-Based Document Analysis

#### Multi-Format File Upload
- **Supported Formats**: PDF, TXT, DOCX, XLSX, Markdown
- Drag-and-drop file upload
- File size validation (up to 50MB)
- File type validation
- Progress indicator during upload
- Multiple file uploads in single session

#### Document Processing
- Automatic text extraction
- Intelligent chunking (1000 tokens with 100 token overlap)
- Embedding generation for each chunk
- Vector storage in FAISS
- Metadata preservation (page numbers, headers)

#### Context-Aware Question Answering
- Semantic similarity search
- Retrieval of top-k relevant chunks
- Response generation based on document content
- Citation of source chunks
- Confidence scoring for retrieved chunks

#### Multi-File Analysis
- Upload multiple files simultaneously
- Track which file is being referenced
- Cross-file context retrieval
- Comparative analysis capabilities
- File management (view, delete, re-upload)

### 3. File Generation and Export

#### Dynamic File Generation
- **Generation Types**: Summaries, Reports, Outlines, Transcripts, Extracted Data
- **Output Formats**: TXT, PDF, DOCX, JSON
- Real-time file generation
- Customizable generation parameters
- Preview before download
- Batch generation for multiple files

#### Export Conversation
- **Export Formats**: TXT, PDF, JSON, Markdown
- Include/exclude metadata
- Custom formatting options
- Compression for large exports
- Email export option

#### File Download Management
- One-click download button
- Download history tracking
- Automatic file naming with timestamps
- Batch download of multiple files
- Download expiration and cleanup

### 4. Conversation Dashboard

#### Conversation History View
- Chronological list of conversations
- Conversation preview (first few messages)
- Last modified timestamp
- Conversation status indicators
- Quick actions (resume, delete, export)

#### Search and Filter Capabilities
- Full-text search across conversation content
- Filter by date range
- Filter by file type
- Filter by conversation status
- Sort by date, relevance, or title
- Saved search filters

#### Conversation Details View
- Complete message history with timestamps
- File attachments display
- Message search within conversation
- Message-level actions (copy, delete, regenerate)
- Conversation metadata (duration, message count)

#### Conversation Management
- Rename conversations
- Add tags or labels
- Archive conversations
- Delete conversations (with confirmation)
- Bulk operations (delete multiple, archive multiple)
- Conversation sharing (optional, with access control)

### 5. User Authentication and Authorization

#### User Registration and Login
- Email-based registration
- Password strength validation
- Email verification (optional)
- Social login integration (Google, GitHub)
- Password reset functionality

#### Session Management
- JWT-based authentication tokens
- Automatic token refresh
- Session timeout with warning
- Multi-device login support
- Logout from all devices

#### Access Control
- User roles (free, premium, admin)
- Feature access based on subscription tier
- Data isolation between users
- Admin dashboard for user management

### 6. Advanced AI Features

#### LLM Provider Selection
- **Supported Providers**: OpenAI, Anthropic, Google, DeepSeek
- Provider selection per conversation
- Automatic provider fallback on errors
- Cost estimation for each provider
- Quality vs. cost trade-off options

#### Prompt Customization
- Custom system prompts
- Temperature and top-p adjustments
- Max token limits
- Response format specifications
- Instruction templates

#### Conversation Regeneration
- Regenerate with same parameters
- Regenerate with different temperature
- Regenerate with different LLM provider
- Compare multiple regenerations side-by-side

#### Advanced Reasoning (Optional Enhancement)
- Chain-of-thought prompting
- Multi-step problem decomposition
- Structured reasoning output
- Explanation generation
- Confidence scoring for reasoning steps

### 7. Integration Features

#### Website Integration
- **Integration Methods**: Script tag injection, React component import, Web component, iFrame embedding
- Single-line script tag for quick setup
- Customizable widget appearance
- Configurable position (bottom-right, bottom-left, etc.)
- Theme customization (light/dark mode)
- Custom branding (logo, colors)

#### API Access
- RESTful API endpoints
- WebSocket support for real-time updates
- API documentation (Swagger/OpenAPI)
- Rate limiting and quota management
- API key management

#### Webhook Support
- **Webhook Events**: Conversation started, Message received, File uploaded, File generated, Conversation completed
- Configurable webhook endpoints
- Retry logic for failed deliveries
- Webhook signature verification
- Event filtering

#### Distributed AI Systems (Optional Enhancement)
- Multi-node backend deployment
- Kubernetes orchestration
- Distributed caching with Redis
- Load balancing across instances
- Horizontal auto-scaling
- Database replication and failover

### 8. Performance and Optimization

#### Response Caching
- Query result caching
- Embedding caching
- Response caching with TTL
- Cache invalidation strategies

#### Lazy Loading
- Lazy load conversation history
- Lazy load file previews
- Pagination for large datasets
- Virtual scrolling for long lists

#### Offline Support
- Cache recent conversations
- Queue messages for sending when online
- Offline message drafts
- Sync when connection restored

### 9. Analytics and Monitoring

#### Usage Analytics
- Number of conversations
- Number of messages
- File upload frequency
- Average response time
- User engagement metrics

#### Error Tracking
- Error logging with stack traces
- Error categorization
- Error rate monitoring
- Alerting on critical errors

#### Performance Monitoring
- API response times
- LLM generation time
- Database query times
- File processing time
- Widget load time

### 10. Accessibility and Usability

#### Accessibility Features
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode
- Text size adjustment

#### Internationalization
- Multi-language UI
- RTL language support
- Localized date/time formatting
- Language auto-detection

#### Mobile Responsiveness
- Touch-friendly interface
- Mobile-optimized layout
- Responsive file upload
- Mobile dashboard view

### 11. Security Features

#### Data Encryption
- HTTPS/TLS for all communications
- End-to-end encryption (optional)
- Encrypted database storage
- Encrypted file storage

#### Data Privacy
- GDPR compliance
- Data retention policies
- User data export
- Right to deletion
- Privacy policy enforcement

#### Content Moderation
- Profanity filtering
- Harmful content detection
- Inappropriate file detection
- Content policy enforcement

#### Advanced Safety Pipelines (Optional Enhancement)
- Toxicity detection using pre-trained models
- Profanity filtering with customizable word lists
- Harmful content classification
- Bias detection in responses
- Jailbreak attempt detection

### 12. Extensibility and Customization

#### Plugin System
- Custom LLM providers
- Custom file parsers
- Custom response formatters
- Custom UI components

#### Custom Integrations
- CRM systems (Salesforce, HubSpot)
- Project management tools (Jira, Asana)
- Communication platforms (Slack, Teams)
- Analytics tools (Google Analytics, Mixpanel)

#### Theming and Branding
- Color schemes
- Font families
- Logo and branding
- Custom CSS
- Widget position and size

---

## System Design Concepts

### Architectural Patterns

#### 1. Microservices Architecture
- **Chat Service**: Handles conversation logic
- **File Service**: Manages file uploads and processing
- **LLM Service**: Orchestrates LLM provider calls
- **Embedding Service**: Generates and manages embeddings
- **User Service**: Manages user accounts and profiles
- **Auth Service**: Handles authentication and authorization

#### 2. Layered Architecture
```
Presentation Layer (React Frontend)
    ↓
API Layer (FastAPI Routes)
    ↓
Service Layer (Business Logic)
    ↓
Data Access Layer (Database & Vector Store)
    ↓
External Services (LLMs, File Storage)
```

#### 3. Design Patterns Implemented

| Pattern | Usage |
| --- | --- |
| **Factory Pattern** | LLM provider creation |
| **Strategy Pattern** | Different embedding strategies |
| **Observer Pattern** | Real-time message updates |
| **Singleton Pattern** | Database connection |
| **Adapter Pattern** | LLM provider abstraction |
| **Decorator Pattern** | Middleware stack |

### Database Design

#### Core Tables

```sql
-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role ENUM('user', 'premium', 'admin'),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    role ENUM('user', 'assistant'),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Files
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    filename VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Embeddings
CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    chunk_text TEXT,
    embedding VECTOR(1536),
    chunk_index INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Caching Strategy

```
Level 1: In-Memory Cache (Redis)
├── Query results (5 min TTL)
├── Embedding cache (24 hour TTL)
└── User session cache (1 hour TTL)

Level 2: Database Cache
├── Frequently accessed conversations
└── User preferences

Level 3: Vector Store Cache (FAISS)
├── Embeddings for active files
└── Similarity search results
```

### Scalability Concepts

#### Horizontal Scaling
- Multiple backend instances behind load balancer
- Database read replicas
- Distributed caching with Redis Cluster
- Message queue for async tasks

#### Vertical Scaling
- Optimize database queries with indexes
- Implement connection pooling
- Use batch processing for embeddings
- Compress stored data

#### Load Balancing
- Round-robin distribution
- Sticky sessions for WebSocket connections
- Health checks for instance availability
- Auto-scaling based on CPU/memory usage

### Security Architecture

#### Authentication Flow
```
User Login
    ↓
Verify Credentials
    ↓
Generate JWT Token
    ↓
Return Token to Client
    ↓
Client Stores Token
    ↓
Include Token in API Requests
    ↓
Server Validates Token
    ↓
Grant Access to Protected Resources
```

#### Authorization Flow
```
User Makes Request
    ↓
Extract Token from Request
    ↓
Validate Token Signature
    ↓
Check Token Expiration
    ↓
Extract User ID from Token
    ↓
Check User Role/Permissions
    ↓
Grant or Deny Access
```

#### Data Security
- Encryption in transit (HTTPS/TLS)
- Encryption at rest (database encryption)
- API key rotation
- Secure password hashing (bcrypt)
- Rate limiting to prevent abuse

### AI/ML Concepts

#### Retrieval-Augmented Generation (RAG)

```
User Query
    ↓
Generate Query Embedding
    ↓
Search Vector Store (FAISS)
    ↓
Retrieve Top-K Relevant Chunks
    ↓
Construct Augmented Prompt
    ├── System prompt
    ├── Retrieved context
    └── User query
    ↓
Send to LLM
    ↓
Generate Response
    ↓
Return to User
```

#### Embedding Generation

```
Document Text
    ↓
Tokenization
    ↓
Embedding Model (OpenAI, Cohere, Google)
    ↓
Vector Representation (768-3072 dimensions)
    ↓
Store in Vector Database
    ↓
Use for Semantic Search
```

#### Semantic Search

```
Query Embedding
    ↓
Calculate Similarity with Document Embeddings
    ├── Cosine Similarity
    ├── Euclidean Distance
    └── Dot Product
    ↓
Rank by Similarity Score
    ↓
Return Top-K Results
```

---

## Technology Stack

### Backend

| Component | Technology | Version |
| --- | --- | --- |
| **Framework** | FastAPI | 0.95+ |
| **Server** | Uvicorn | 0.20+ |
| **Database** | PostgreSQL | 13+ |
| **ORM** | SQLAlchemy | 2.0+ |
| **Vector Store** | FAISS | Latest |
| **LLM Framework** | LangChain | 0.1+ |
| **Embeddings** | OpenAI, Cohere, Google | Latest |
| **Authentication** | JWT (PyJWT) | 2.6+ |
| **Validation** | Pydantic | 2.0+ |
| **Async** | AsyncIO, Celery | Latest |
| **Testing** | Pytest | 7.0+ |
| **API Docs** | Swagger/OpenAPI | 3.0 |

### Frontend

| Component | Technology | Version |
| --- | --- | --- |
| **Framework** | React | 18+ |
| **Language** | TypeScript | 5.0+ |
| **Build Tool** | Vite | 4.0+ |
| **State Management** | Zustand | 4.0+ |
| **HTTP Client** | Axios | 1.0+ |
| **UI Components** | shadcn/ui | Latest |
| **Styling** | Tailwind CSS | 3.0+ |
| **Icons** | Lucide React | Latest |
| **Testing** | Vitest, React Testing Library | Latest |
| **Linting** | ESLint | 8.0+ |
| **Formatting** | Prettier | 3.0+ |

### DevOps & Infrastructure

| Component | Technology | Purpose |
| --- | --- | --- |
| **Containerization** | Docker | Package application |
| **Orchestration** | Docker Compose, Kubernetes | Deployment |
| **CI/CD** | GitHub Actions | Automated testing & deployment |
| **Monitoring** | Prometheus, Grafana | Performance monitoring |
| **Logging** | ELK Stack | Centralized logging |
| **Cache** | Redis | Distributed caching |
| **Message Queue** | RabbitMQ, Celery | Async task processing |
| **File Storage** | S3, MinIO | Object storage |

### External Services

| Service | Provider | Purpose |
| --- | --- | --- |
| **LLM** | Google Gemini 2.5 Flash | Primary AI model |
| **LLM Fallback** | OpenAI, Anthropic, DeepSeek | Alternative models |
| **Embeddings** | OpenAI, Cohere, Google | Vector representations |
| **Authentication** | OAuth 2.0 | User login |
| **Email** | SendGrid, AWS SES | Email notifications |

---

## LLM Model Selection

### Recommended Model: Google Gemini 2.5 Flash

#### Why Gemini 2.5 Flash?

| Factor | Gemini 2.5 Flash | Reason |
| --- | --- | --- |
| **Cost** | $0.075/1M input tokens | 20x cheaper than GPT-4 |
| **Speed** | 1-3 seconds | Fast response time |
| **Context Window** | 1M tokens | Large document support |
| **Reliability** | 99.9% uptime | Google's infrastructure |
| **Free Tier** | 60 requests/minute | Perfect for testing |

### Multi-Model Strategy

```
Tier 1 (80%): Gemini 2.5 Flash
├── Cost-effective
├── Fast
└── Reliable

Tier 2 (15%): Claude 3.5 Sonnet
├── Premium quality
├── Complex reasoning
└── Better for edge cases

Tier 3 (5%): DeepSeek V3.2
├── Ultra-cheap fallback
├── Bulk processing
└── Cost optimization
```

### Cost Estimation

**For 10,000 users with 50 requests/user/month:**

```
Total requests: 500,000/month

Token usage:
- Input: 100M tokens
- Output: 75M tokens

Cost:
- Input: $7.50
- Output: $22.50
- Total: $30/month

Per user: $0.003/month
```

### Getting Started with Gemini

#### Step 1: Get API Key

**Option A: Google AI Studio (Fastest)**
1. Go to https://aistudio.google.com/
2. Click "Get API Key"
3. Copy your API key
4. Start using immediately

**Option B: Google Cloud Console (Production)**
1. Go to https://console.cloud.google.com/
2. Create new project
3. Enable Generative Language API
4. Create API key
5. Set up billing

#### Step 2: Install SDK

```bash
pip install google-generativeai
```

#### Step 3: Basic Usage

```python
import google.generativeai as genai
import os

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

model = genai.GenerativeModel("gemini-2.5-flash")
response = model.generate_content("Hello!")
print(response.text)
```

#### Step 4: With Files

```python
import google.generativeai as genai

model = genai.GenerativeModel("gemini-2.5-flash")

# Upload file
uploaded_file = genai.upload_file("document.pdf")

# Ask question about file
response = model.generate_content([
    "Summarize this document:",
    uploaded_file
])

print(response.text)
```

---

## Project Structure

### Directory Organization

```
chatbot-widget/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── services/          # Business logic
│   │   ├── models/            # Pydantic models
│   │   ├── schemas/           # Database schemas
│   │   ├── llm/               # LLM integration
│   │   ├── safety/            # (OPTIONAL) Safety pipelines
│   │   ├── distributed/       # (OPTIONAL) Distributed systems
│   │   └── core/              # Core utilities
│   ├── tests/                 # Test files
│   ├── requirements.txt        # Dependencies
│   └── Dockerfile             # Backend image (see also docker/backend.Dockerfile)
│
├── client/                    # React + Vite widget (npm workspace)
│   ├── src/
│   │   └── components/        # Floating widget, Auth, Chat UI
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
│
├── docs/                       # Documentation
│   ├── 01_system_overview.md
│   ├── 02_architecture_diagrams.md
│   ├── 03_features_capabilities.md
│   ├── 04_ml_ai_concepts.md
│   ├── 05_project_structure.md
│   ├── 06_api_documentation.md
│   ├── 07_deployment_guide.md
│   ├── 08_development_guide.md
│   ├── 09_testing_strategy.md
│   ├── 10_security_guide.md
│   └── images/
│
├── docker/                     # Docker configs
│   ├── backend.Dockerfile
│   ├── client.Dockerfile      # Builds static widget from ./client
│   ├── nginx.conf
│   └── kubernetes/            # (OPTIONAL) K8s configs
│
├── scripts/                    # Utility scripts
│   ├── setup.sh
│   ├── dev.sh
│   ├── test.sh
│   ├── build.sh
│   ├── deploy.sh
│   └── setup-optional.sh       # (OPTIONAL) Setup enhancements
│
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production
├── .env.example                # Environment template
├── README.md                   # This file
└── LICENSE                     # License
```

---

## Optional Enhancements

### 1. Advanced Reasoning (Medium Priority)

**When to Add**: Complex problem-solving needed

**What It Does**:
- Chain-of-thought prompting
- Step-by-step reasoning display
- Multi-step problem decomposition
- Explanation generation

**Implementation**:
```python
system_prompt = """
You are a reasoning assistant. When solving problems:
1. Break down the problem into steps
2. Show your reasoning at each step
3. Provide the final answer

Format your response as:
Step 1: [reasoning]
Step 2: [reasoning]
Final Answer: [answer]
"""
```

**Setup**:
```bash
bash scripts/setup-reasoning.sh
```

### 2. Advanced Safety Pipelines (High Priority)

**When to Add**: High-risk applications or compliance requirements

**What It Does**:
- Toxicity detection
- Profanity filtering
- Bias detection
- Jailbreak prevention
- Harmful content classification

**Implementation**:
```python
from better_profanity import profanity
from transformers import pipeline

def filter_response(text):
    return profanity.contains_profanity(text)

toxicity_classifier = pipeline("text-classification", 
                               model="cardiffnlp/twitter-roberta-base-hate")
```

**Setup**:
```bash
bash scripts/setup-safety.sh
```

### 3. Distributed AI Systems (Medium Priority)

**When to Add**: 1000+ concurrent users

**What It Does**:
- Multi-node deployment
- Kubernetes orchestration
- Distributed caching with Redis
- Load balancing
- Auto-scaling

**Implementation**:
```bash
# Multi-node deployment
kubectl create deployment chatbot-backend --image=chatbot:latest --replicas=3
kubectl expose deployment chatbot-backend --port=8000 --target-port=8000

# Redis caching
docker run -d -p 6379:6379 redis:latest
```

**Setup**:
```bash
bash scripts/setup-distributed.sh
```

---

## Setup & Installation

### Windows 11 i5 Specific Setup

#### Prerequisites Installation

**1. Python Installation**
```bash
# Download from https://www.python.org/downloads/
# Choose Python 3.11 or later
# During installation, check "Add Python to PATH"

# Verify installation
python --version
```

**2. Node.js Installation**
```bash
# Download from https://nodejs.org/
# Choose LTS version
# Follow installer

# Verify installation
node --version
npm --version
```

**3. Git Installation**
```bash
# Download from https://git-scm.com/
# Follow installer
# Verify installation
git --version
```

**4. Docker Installation (Optional)**
```bash
# Download Docker Desktop from https://www.docker.com/
# Follow installer
# Verify installation
docker --version
```

#### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env

# Edit .env and add your API keys
# GOOGLE_API_KEY=your_key_here
# DATABASE_URL=postgresql://user:password@localhost/chatbot_db

# Run database migrations
alembic upgrade head

# Start development server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Widget (`client/` + Vite)

```bash
# From repo root (recommended — installs the client workspace + matches package.json scripts)
npm install

# Env: use repo-root .env.local (Vite envDir includes parent folder)
copy .env.example .env.local
# Ensure VITE_API_URL=http://localhost:8000 (or your API origin)

npm run dev
# Open the URL shown in the terminal (default http://127.0.0.1:5173)
```

#### Database Setup

```bash
# Install PostgreSQL
# Download from https://www.postgresql.org/download/

# Create database
createdb chatbot_db

# Run migrations
cd backend
alembic upgrade head
```

### Docker Setup (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## API Documentation

### Base URL
```
http://localhost:8000/api/v1
```

### Authentication
All requests require JWT token in header:
```
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

#### Chat Endpoints

**Send Message**
```
POST /chat/message
Content-Type: application/json

{
  "conversation_id": "uuid",
  "message": "What is machine learning?",
  "llm_provider": "gemini"
}

Response:
{
  "id": "message_id",
  "conversation_id": "uuid",
  "role": "assistant",
  "content": "Machine learning is...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Stream Message**
```
POST /chat/stream
Content-Type: application/json

{
  "conversation_id": "uuid",
  "message": "Write a story",
  "stream": true
}

Response: Server-Sent Events stream
```

#### File Endpoints

**Upload File**
```
POST /files/upload
Content-Type: multipart/form-data

file: <binary_file>
conversation_id: uuid

Response:
{
  "id": "file_id",
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 1024000,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Ask Question About File**
```
POST /files/question
Content-Type: application/json

{
  "file_id": "file_id",
  "question": "What is the main topic?",
  "llm_provider": "gemini"
}

Response:
{
  "answer": "The main topic is...",
  "sources": [
    {
      "chunk_index": 0,
      "text": "...",
      "confidence": 0.95
    }
  ]
}
```

#### Conversation Endpoints

**Get Conversations**
```
GET /conversations

Response:
{
  "conversations": [
    {
      "id": "uuid",
      "title": "ML Discussion",
      "created_at": "2024-01-15T10:30:00Z",
      "message_count": 5
    }
  ]
}
```

**Get Conversation Details**
```
GET /conversations/{conversation_id}

Response:
{
  "id": "uuid",
  "title": "ML Discussion",
  "messages": [...],
  "files": [...],
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Deployment

### Development Deployment

```bash
# Using Docker Compose
docker-compose up -d

# Local dev widget: npm run dev → usually http://127.0.0.1:5173
```

### Production Deployment

#### Option 1: Docker + Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: Kubernetes

```bash
# Create namespace
kubectl create namespace chatbot

# Deploy backend
kubectl apply -f docker/kubernetes/backend-deployment.yaml -n chatbot

# Deploy widget (SPA, nginx — build with docker/client.Dockerfile first)
kubectl apply -f docker/kubernetes/client-deployment.yaml -n chatbot

# Deploy services
kubectl apply -f docker/kubernetes/service.yaml -n chatbot

# Check deployment
kubectl get pods -n chatbot
```

#### Option 3: Cloud Platforms

**AWS**:
- Use ECS for container orchestration
- Use RDS for PostgreSQL
- Use ElastiCache for Redis
- Use CloudFront for CDN

**Google Cloud**:
- Use Cloud Run for serverless
- Use Cloud SQL for PostgreSQL
- Use Memorystore for Redis
- Use Cloud CDN

**Azure**:
- Use Container Instances
- Use Azure Database for PostgreSQL
- Use Azure Cache for Redis
- Use Azure CDN

### Environment Variables for Production

```bash
# Database
DATABASE_URL=postgresql://user:password@prod-db:5432/chatbot_db
DATABASE_POOL_SIZE=20

# LLM
GOOGLE_API_KEY=your_production_key
OPENAI_API_KEY=your_production_key

# Security
JWT_SECRET=your_secure_secret
CORS_ORIGINS=https://yourdomain.com

# Cache
REDIS_URL=redis://prod-redis:6379

# Storage
S3_BUCKET=chatbot-files
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Optional: Distributed
KUBERNETES_ENABLED=true
ENABLE_DISTRIBUTED=true

# Optional: Safety
ENABLE_SAFETY=true
TOXICITY_MODEL=cardiffnlp/twitter-roberta-base-hate
```

---

## Security & Best Practices

### Authentication Best Practices

1. **JWT Token Management**
   - Use secure secret key (minimum 32 characters)
   - Set appropriate expiration (15-30 minutes)
   - Implement token refresh mechanism
   - Store tokens securely on client

2. **Password Security**
   - Use bcrypt for hashing
   - Enforce strong password requirements
   - Implement rate limiting on login
   - Use HTTPS for all auth requests

3. **API Key Management**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys regularly
   - Implement API key scoping

### Data Protection

1. **Encryption**
   - HTTPS/TLS for all communications
   - Encrypt sensitive data at rest
   - Use secure key management

2. **Data Privacy**
   - GDPR compliance
   - Data retention policies
   - User data export functionality
   - Right to deletion

3. **Access Control**
   - Role-based access control (RBAC)
   - Principle of least privilege
   - Audit logging
   - Regular security audits

### Rate Limiting

```python
# Implement rate limiting
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@app.post("/chat/message")
@limiter.limit("100/minute")
async def send_message(request: ChatRequest):
    # Handle request
    pass
```

### Input Validation

```python
# Validate all inputs
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str = Field(..., regex="^[a-f0-9-]{36}$")
    llm_provider: str = Field(..., regex="^(gemini|openai|claude|deepseek)$")
```

---

## Troubleshooting

### Common Issues

#### 1. "GOOGLE_API_KEY not found"

**Solution**:
```bash
# Set environment variable
export GOOGLE_API_KEY=your_key_here

# Or add to .env file
GOOGLE_API_KEY=your_key_here
```

#### 2. "Database connection refused"

**Solution**:
```bash
# Check if PostgreSQL is running
psql -U postgres

# Or start with Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
```

#### 3. "Port 8000 already in use"

**Solution**:
```bash
# Use different port
python -m uvicorn app.main:app --port 8001

# Or kill process using port 8000
# On Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -i :8000
kill -9 <PID>
```

#### 4. "CORS error when accessing from frontend"

**Solution**:
```python
# Update CORS settings in backend
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 5. "File upload fails"

**Solution**:
```bash
# Check file size limit
# Default: 50MB

# Increase limit in backend
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Check disk space
df -h  # On Mac/Linux
dir C:\  # On Windows
```

### Performance Optimization

1. **Database Optimization**
   - Add indexes on frequently queried columns
   - Use connection pooling
   - Optimize queries with EXPLAIN

2. **Caching Strategy**
   - Cache embeddings
   - Cache LLM responses
   - Use Redis for distributed caching

3. **Frontend Optimization**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Minification

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see LICENSE file for details.

---

## Support

For support, email support@chatbot-widget.com or open an issue on GitHub.

---

## Roadmap

### Q1 2024
- [ ] Advanced reasoning with chain-of-thought
- [ ] Safety pipeline implementation
- [ ] Mobile app (React Native)

### Q2 2024
- [ ] Kubernetes deployment guide
- [ ] Multi-language support
- [ ] Voice input/output

### Q3 2024
- [ ] Custom model fine-tuning
- [ ] Advanced analytics dashboard
- [ ] Enterprise features

### Q4 2024
- [ ] AI-powered conversation summarization
- [ ] Predictive analytics
- [ ] Advanced integrations

---

## Acknowledgments

- Google Gemini for LLM capabilities
- OpenAI, Anthropic, DeepSeek for alternative models
- FastAPI for backend framework
- React for frontend framework
- LangChain for RAG implementation

---

## FAQ

**Q: Can I use this for production?**
A: Yes! The system is designed to be production-ready with security, authentication, and scalability features.

**Q: What's the cost?**
A: Depends on usage. For 10,000 users with 50 requests/month, approximately $30/month for Gemini API.

**Q: Can I use different LLM providers?**
A: Yes! The system supports Gemini, OpenAI, Claude, and DeepSeek. You can switch providers per conversation.

**Q: Is data encrypted?**
A: Yes! All data is encrypted in transit (HTTPS) and at rest (database encryption).

**Q: Can I self-host?**
A: Yes! You can deploy using Docker, Kubernetes, or any cloud platform.

**Q: What file formats are supported?**
A: PDF, TXT, DOCX, XLSX, and Markdown.

**Q: Is there a free tier?**
A: Yes! Gemini API offers 60 requests/minute free tier for development.

---

## Version History

| Version | Date | Changes |
| --- | --- | --- |
| 1.0.0 | 2026-05-25 | Initial release |
| 1.1.0 | 2024-02-15 | Added optional enhancements |
| 1.2.0 | 2024-03-15 | Kubernetes support |

---

**Last Updated**: May 25, 2026
**Maintainer**: Chatbot Widget Team
**Status**: Active Development
