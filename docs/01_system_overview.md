# 01_system_overview

## Executive Summary

The AI Chatbot Widget is a sophisticated, embeddable solution designed for integration into existing websites. It provides users with a dual-purpose conversational interface: a general-purpose AI assistant and a file-based document analysis tool. The system supports real-time conversations, file uploads, document-specific queries, file generation, conversation history management, and an intuitive dashboard for reviewing past interactions.

---

## 1. System Architecture Overview

### 1.1. High-Level Architecture (HLA)

The chatbot widget system follows a three-tier architecture: frontend (widget), backend (API server), and data layer (database).

```mermaid
graph TB
    subgraph Client["Client (Website)"]
        A["Website Host"]
        B["Chatbot Widget<br/>(React Component)"]
        A --> B
    end

    subgraph Server["Backend Server"]
        C["FastAPI Server"]
        D["LLM Orchestrator<br/>(LangChain)"]
        E["File Handler"]
        F["Vector Store<br/>(FAISS)"]
    end

    subgraph Data["Data Layer"]
        G["PostgreSQL Database"]
        H["File Storage<br/>(S3/Local)"]
    end

    B -->|HTTP/WebSocket| C
    C --> D
    C --> E
    C --> F
    D -->|Query| G
    E -->|Store/Retrieve| H
    F -->|Embeddings| G
```

### 1.2. Component Breakdown

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Widget** | React + TypeScript | Embeddable chat interface with file upload and edit capabilities. |
| **Backend API** | FastAPI (Python) | REST API for chat, file processing, and conversation management. |
| **LLM Integration** | LangChain + OpenAI/Anthropic | Conversational AI and document analysis. |
| **Vector Store** | FAISS | Efficient similarity search for document retrieval. |
| **Database** | PostgreSQL | Persistent storage for conversations, users, and metadata. |
| **File Storage** | AWS S3 or Local | Storage for uploaded files and generated outputs. |

---

## 2. System Workflow

### 2.1. General Chat Flow

The user initiates a conversation with the chatbot widget, which sends the query to the backend API. The backend processes the query using the LLM and returns a response.

```mermaid
sequenceDiagram
    participant User
    participant Widget as Chatbot Widget
    participant API as FastAPI Backend
    participant LLM as LLM (OpenAI/Anthropic)
    participant DB as Database

    User->>Widget: Types message
    Widget->>Widget: User can edit message before sending
    User->>Widget: Clicks Send
    Widget->>API: POST /chat (user_id, message, session_id)
    API->>LLM: Process query with context
    LLM->>API: Return response
    API->>DB: Store conversation
    API->>Widget: Return response
    Widget->>User: Display response in chat
```

### 2.2. File Upload and Document Analysis Flow

When a user uploads a file, the system processes it, generates embeddings, and stores them for future retrieval.

```mermaid
sequenceDiagram
    participant User
    participant Widget as Chatbot Widget
    participant API as FastAPI Backend
    participant Processor as File Processor
    participant Embedder as Embedding Model
    participant VectorStore as Vector Store
    participant DB as Database

    User->>Widget: Uploads file
    Widget->>API: POST /upload (file, user_id, session_id)
    API->>Processor: Parse file (PDF/TXT/DOCX)
    Processor->>Processor: Split into chunks
    Processor->>Embedder: Generate embeddings
    Embedder->>VectorStore: Store embeddings + chunks
    VectorStore->>DB: Save file metadata
    API->>Widget: Return success + file_id
    Widget->>User: Display file uploaded notification
```

### 2.3. File-Based Query Flow

When the user asks a question about an uploaded file, the system retrieves relevant context from the vector store and generates a response.

```mermaid
sequenceDiagram
    participant User
    participant Widget as Chatbot Widget
    participant API as FastAPI Backend
    participant VectorStore as Vector Store
    participant LLM as LLM
    participant DB as Database

    User->>Widget: Asks question about file
    Widget->>API: POST /chat (message, file_id, session_id)
    API->>VectorStore: Retrieve relevant chunks
    VectorStore->>API: Return context
    API->>LLM: Generate response with context
    LLM->>API: Return response
    API->>DB: Store conversation with file reference
    API->>Widget: Return response
    Widget->>User: Display response
```

### 2.4. Edit Chat Feature Flow

The user can edit their message before sending it to the backend.

```mermaid
sequenceDiagram
    participant User
    participant Widget as Chatbot Widget

    User->>Widget: Types message
    Widget->>Widget: Message appears in input field
    User->>Widget: Clicks Edit button (or message is not sent yet)
    Widget->>Widget: Allows inline editing
    User->>Widget: Modifies text
    User->>Widget: Clicks Send
    Widget->>Widget: Validates message
    Widget->>Widget: Sends to backend
```

---

## 3. User Stories and Use Cases

### 3.1. Epic 1: General AI Assistance

**User Story 1.1**: As a website visitor, I want to click on a chat widget and ask general questions so that I can get quick answers without leaving the website.

**User Story 1.2**: As a user, I want to see my conversation history in a dashboard so that I can review previous interactions.

**User Story 1.3**: As a user, I want to edit my message before sending it so that I can correct typos or rephrase my question.

### 3.2. Epic 2: File-Based Document Analysis

**User Story 2.1**: As a user, I want to upload a document (PDF, TXT, DOCX) so that I can ask questions specific to that document.

**User Story 2.2**: As a user, I want the chatbot to answer questions based only on the uploaded document content so that I receive accurate, grounded responses.

**User Story 2.3**: As a user, I want to upload multiple files in a single session so that I can compare or analyze multiple documents.

### 3.3. Epic 3: File Generation and Export

**User Story 3.1**: As a user, I want to request the chatbot to generate a summary or report so that I can download it as a file.

**User Story 3.2**: As a user, I want to export my conversation as a text or PDF file so that I can save or share it.

### 3.4. Epic 4: Dashboard and History Management

**User Story 4.1**: As a user, I want to view all my past conversations in a dashboard so that I can quickly find and resume previous discussions.

**User Story 4.2**: As a user, I want to search my conversation history so that I can find specific topics or files I discussed.

**User Story 4.3**: As a user, I want to delete conversations so that I can manage my data and privacy.

### 3.5. Use Cases

**Use Case 1: Customer Support Chatbot**
- A customer visits a website and clicks the chat widget to ask about product features.
- The chatbot provides instant answers based on the company's knowledge base.
- The customer can access their support history from the dashboard.

**Use Case 2: Document Analysis**
- A user uploads a legal contract and asks the chatbot to identify key clauses.
- The chatbot analyzes the document and provides specific, accurate answers.
- The user can download a summary of the contract.

**Use Case 3: Research Assistant**
- A researcher uploads multiple academic papers and asks comparative questions.
- The chatbot retrieves relevant sections from each paper and synthesizes an answer.
- The researcher exports the conversation for citation purposes.

**Use Case 4: Content Generation**
- A content creator asks the chatbot to generate blog post outlines or social media captions.
- The chatbot generates content, which the user can download.
- The user can edit the generated content and ask for revisions.

---

## 4. Technical Design (HLD & LLD)

### 4.1. High-Level Design (HLD)

The HLD focuses on the major components and their interactions:

```mermaid
graph TD
    A["Website Host"] -->|Embeds| B["React Widget"]
    B -->|API Calls| C["FastAPI Backend"]
    C -->|Query| D["LLM Service"]
    C -->|Store| E["PostgreSQL"]
    C -->|Retrieve| F["Vector Store"]
    C -->|Upload/Download| G["File Storage"]
    D -->|Generate Embeddings| F
```

### 4.2. Low-Level Design (LLD)

The LLD details the internal structure of each component:

```mermaid
graph TD
    subgraph Widget["React Widget"]
        W1["Chat Interface"]
        W2["File Upload Component"]
        W3["Message Editor"]
        W4["Local State Management"]
    end

    subgraph Backend["FastAPI Backend"]
        B1["Route Handlers"]
        B2["Authentication Middleware"]
        B3["File Processing Module"]
        B4["LLM Orchestrator"]
        B5["Vector Store Manager"]
    end

    subgraph Services["External Services"]
        S1["OpenAI/Anthropic API"]
        S2["FAISS Vector Store"]
        S3["PostgreSQL Database"]
    end

    W1 --> B1
    W2 --> B3
    W3 --> B1
    B1 --> B4
    B3 --> B5
    B4 --> S1
    B5 --> S2
    B1 --> S3
```

---

## 5. Technology Stack

### 5.1. Frontend

| Technology | Purpose |
| :--- | :--- |
| **React 18+** | Component-based UI framework for the widget. |
| **TypeScript** | Type-safe JavaScript for better code quality. |
| **Tailwind CSS** | Utility-first CSS framework for styling. |
| **Axios** | HTTP client for API communication. |
| **React Query** | Data fetching and caching library. |
| **Zustand** | Lightweight state management. |

### 5.2. Backend

| Technology | Purpose |
| :--- | :--- |
| **FastAPI** | Modern, fast Python web framework for building APIs. |
| **LangChain** | Framework for developing LLM applications. |
| **LangChain-OpenAI** | Integration with OpenAI models. |
| **LangChain-Anthropic** | Integration with Anthropic models. |
| **FAISS** | Vector similarity search library. |
| **PyPDF** | PDF parsing and text extraction. |
| **python-docx** | DOCX file handling. |
| **SQLAlchemy** | ORM for database interactions. |
| **Pydantic** | Data validation and settings management. |

### 5.3. Database

| Technology | Purpose |
| :--- | :--- |
| **PostgreSQL** | Relational database for storing conversations, users, and metadata. |
| **pgvector** | PostgreSQL extension for vector similarity search (optional). |

### 5.4. File Storage

| Technology | Purpose |
| :--- | :--- |
| **AWS S3** | Cloud-based file storage (production). |
| **Local File System** | File storage for development/testing. |

### 5.5. Deployment

| Technology | Purpose |
| :--- | :--- |
| **Docker** | Containerization for consistent deployment. |
| **Docker Compose** | Multi-container orchestration for local development. |
| **Nginx** | Reverse proxy and load balancing. |
| **Gunicorn** | WSGI server for FastAPI deployment. |

---

## 6. Local Setup for Windows 11 (i5 Processor)

### 6.1. Prerequisites

1. **Python 3.9+**: Download from [python.org](https://www.python.org/downloads/). Ensure "Add Python to PATH" is checked.
2. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/).
3. **PostgreSQL 14+**: Download from [postgresql.org](https://www.postgresql.org/download/windows/).
4. **Git**: Download from [git-scm.com](https://git-scm.com/).
5. **Docker Desktop** (Optional): For containerized development.
6. **OpenAI API Key**: Obtain from [platform.openai.com](https://platform.openai.com/).

### 6.2. Step-by-Step Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/chatbot-widget.git
   cd chatbot-widget
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Environment Configuration**:
   Create a `.env` file in the backend directory:
   ```
   OPENAI_API_KEY=your_api_key_here
   DATABASE_URL=postgresql://user:password@localhost/chatbot_db
   JWT_SECRET=your_secret_key
   ```

4. **Database Setup**:
   ```bash
   python -m alembic upgrade head
   ```

5. **Frontend Setup**:
   ```bash
   cd ../client
   npm install
   ```

6. **Run the Application**:
   - Backend: `python -m uvicorn main:app --reload`
   - Frontend: `npm start`

---

## 7. Database Schema

The system uses PostgreSQL with the following primary tables:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id),
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. API Endpoints

### 8.1. Chat Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/chat` | Send a message and get a response. |
| GET | `/api/conversations` | Retrieve all conversations for a user. |
| GET | `/api/conversations/{id}` | Retrieve a specific conversation. |
| DELETE | `/api/conversations/{id}` | Delete a conversation. |

### 8.2. File Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/upload` | Upload a file for analysis. |
| GET | `/api/files` | Retrieve all files for a user. |
| DELETE | `/api/files/{id}` | Delete a file. |
| POST | `/api/generate` | Generate a file (summary, report, etc.). |

### 8.3. User Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/auth/register` | Register a new user. |
| POST | `/api/auth/login` | Authenticate and get a JWT token. |
| GET | `/api/user/profile` | Retrieve user profile. |

---

## 9. Security Considerations

The system implements several security measures:

1. **Authentication**: JWT-based token authentication for API endpoints.
2. **Authorization**: Role-based access control (RBAC) for conversations and files.
3. **Data Encryption**: HTTPS for all API communications.
4. **File Validation**: Strict validation of uploaded files to prevent malicious uploads.
5. **Rate Limiting**: API rate limiting to prevent abuse.
6. **SQL Injection Prevention**: Parameterized queries via SQLAlchemy ORM.

---

## 10. Deployment Strategies

### 10.1. Development Environment

For local development on Windows 11, run both backend and frontend on localhost with hot-reload enabled.

### 10.2. Production Environment

For production deployment:

1. **Containerize** the application using Docker.
2. **Deploy** to cloud platforms (AWS, GCP, Azure) or self-hosted servers.
3. **Use** a reverse proxy (Nginx) for routing and SSL termination.
4. **Implement** CI/CD pipelines for automated testing and deployment.
5. **Monitor** application performance and logs using tools like ELK Stack or DataDog.

---

## 11. Conclusion

The AI Chatbot Widget is a comprehensive, production-ready solution that combines the flexibility of a general-purpose AI assistant with the precision of file-based document analysis. Its modular architecture allows for easy customization and integration into any website, while its robust backend ensures scalability and reliability.
