# 08_development_guide

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Backend Development](#backend-development)
5. [Frontend Development](#frontend-development)
6. [Database Development](#database-development)
7. [Testing](#testing)
8. [Code Quality](#code-quality)
9. [Debugging](#debugging)
10. [Common Tasks](#common-tasks)

---

## Environment Setup

### Prerequisites

- **Python**: 3.10+
- **Node.js**: 18+
- **PostgreSQL**: 14+
- **Redis**: 7+
- **Git**: 2.40+

### Windows 11 i5 Setup

#### Step 1: Install Python

```bash
# Download from python.org or use Windows Store
python --version  # Should be 3.10+

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate
```

#### Step 2: Install Node.js

```bash
# Download from nodejs.org
node --version  # Should be 18+
npm --version   # Should be 9+
```

#### Step 3: Install PostgreSQL

```bash
# Download from postgresql.org
# During installation, remember the password for postgres user

# Verify installation
psql --version
```

#### Step 4: Install Redis

```bash
# Option 1: Using WSL (Windows Subsystem for Linux)
# In WSL terminal:
sudo apt-get install redis-server
redis-server

# Option 2: Using Docker
docker run -d -p 6379:6379 redis:latest
```

#### Step 5: Clone Repository

```bash
git clone https://github.com/chatbot-widget/repo.git
cd chatbot_widget
```

### Environment Variables

Create `.env` file in project root:

```bash
# Backend
FASTAPI_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatbot_widget
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# LLM APIs
GOOGLE_API_KEY=your-google-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Frontend
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000/ws

# Email (Optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Installation

```bash
# Backend dependencies
cd backend
pip install -r requirements.txt

# Frontend dependencies
cd ../client
npm install

# Create database
cd ../backend
python -m alembic upgrade head
```

---

## Project Structure

```
chatbot_widget/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Configuration
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py         # Authentication endpoints
│   │   │   │   ├── chat.py         # Chat endpoints
│   │   │   │   ├── files.py        # File endpoints
│   │   │   │   ├── conversations.py # Conversation endpoints
│   │   │   │   ├── users.py        # User endpoints
│   │   │   │   └── admin.py        # Admin endpoints
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── chat_service.py     # Chat logic
│   │   │   ├── file_service.py     # File processing
│   │   │   ├── llm_service.py      # LLM integration
│   │   │   ├── embedding_service.py # Embeddings
│   │   │   └── auth_service.py     # Authentication
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py             # User model
│   │   │   ├── conversation.py     # Conversation model
│   │   │   ├── message.py          # Message model
│   │   │   └── file.py             # File model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py             # User schemas
│   │   │   ├── chat.py             # Chat schemas
│   │   │   └── file.py             # File schemas
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py       # DB connection
│   │   │   ├── base.py             # Base model
│   │   │   └── session.py          # Session management
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # Auth middleware
│   │   │   ├── error_handler.py    # Error handling
│   │   │   └── rate_limiter.py     # Rate limiting
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── logger.py           # Logging
│   │   │   ├── validators.py       # Validation
│   │   │   └── helpers.py          # Helper functions
│   │   └── websocket/
│   │       ├── __init__.py
│   │       └── manager.py          # WebSocket management
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_auth.py
│   │   ├── test_chat.py
│   │   ├── test_files.py
│   │   └── conftest.py             # Pytest fixtures
│   ├── migrations/                 # Alembic migrations
│   ├── requirements.txt
│   └── main.py                     # Entry point
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget/
│   │   │   │   ├── ChatWidget.tsx
│   │   │   │   ├── ChatWidget.module.css
│   │   │   │   └── types.ts
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ConversationList.tsx
│   │   │   │   └── Dashboard.module.css
│   │   │   ├── FileUpload/
│   │   │   │   ├── FileUpload.tsx
│   │   │   │   └── FileUpload.module.css
│   │   │   ├── MessageEditor/
│   │   │   │   ├── MessageEditor.tsx
│   │   │   │   └── MessageEditor.module.css
│   │   │   └── Common/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Spinner.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   ├── useConversations.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useWebSocket.ts
│   │   ├── services/
│   │   │   ├── api.ts              # API client
│   │   │   ├── auth.ts             # Auth service
│   │   │   └── storage.ts          # Local storage
│   │   ├── store/
│   │   │   ├── chatStore.ts        # Chat state
│   │   │   ├── userStore.ts        # User state
│   │   │   └── uiStore.ts          # UI state
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   └── models.ts
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   ├── variables.css
│   │   │   └── themes.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── .env.example
├── README.md
└── docs/
    └── (documentation files)
```

---

## Development Workflow

### 1. Start Development Servers

#### Backend

```bash
cd backend
source venv/Scripts/activate  # On Windows: venv\Scripts\activate
python main.py
# Server runs on http://localhost:8000
```

#### Frontend

```bash
cd client
npm run dev
# Dev server runs on http://localhost:5173
```

#### Database & Redis

```bash
# PostgreSQL (if not running as service)
psql -U postgres -d chatbot_widget

# Redis
redis-server
```

### 2. Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/feature-name

# Create Pull Request on GitHub
```

### 3. Code Review Process

1. Create PR with description
2. Wait for CI/CD checks to pass
3. Request review from team members
4. Address feedback and update PR
5. Merge to main branch

---

## Backend Development

### Creating a New Endpoint

#### Step 1: Define Schema

```python
# backend/app/schemas/chat.py
from pydantic import BaseModel

class MessageRequest(BaseModel):
    conversationId: str
    message: str
    model: str = "gemini-2.5-flash"
    temperature: float = 0.7
```

#### Step 2: Create Service

```python
# backend/app/services/chat_service.py
from app.schemas.chat import MessageRequest

class ChatService:
    async def process_message(self, request: MessageRequest):
        # Business logic here
        response = await self.llm_service.generate_response(request.message)
        return response
```

#### Step 3: Create Endpoint

```python
# backend/app/api/v1/chat.py
from fastapi import APIRouter, Depends
from app.schemas.chat import MessageRequest
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/message")
async def send_message(
    request: MessageRequest,
    chat_service: ChatService = Depends()
):
    response = await chat_service.process_message(request)
    return {"success": True, "data": response}
```

#### Step 4: Register Route

```python
# backend/app/main.py
from app.api.v1 import chat

app.include_router(chat.router, prefix="/api/v1")
```

### Database Queries

```python
# Using SQLAlchemy ORM
from app.models.message import Message
from app.database.session import get_db

async def get_messages(conversation_id: str, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).all()
    return messages
```

### Error Handling

```python
from fastapi import HTTPException

@router.post("/message")
async def send_message(request: MessageRequest):
    try:
        response = await chat_service.process_message(request)
        return {"success": True, "data": response}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## Frontend Development

### Creating a New Component

#### Step 1: Create Component File

```typescript
// client/src/components/ChatWidget/ChatWidget.tsx
import React, { useState } from 'react';
import styles from './ChatWidget.module.css';

interface ChatWidgetProps {
  conversationId: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div className={styles.container}>
      {/* Component JSX */}
    </div>
  );
};

export default ChatWidget;
```

#### Step 2: Create Styles

```css
/* client/src/components/ChatWidget/ChatWidget.module.css */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

#### Step 3: Use Custom Hook

```typescript
// client/src/hooks/useChat.ts
import { useState, useCallback } from 'react';
import { api } from '@/services/api';

export const useChat = (conversationId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setLoading(true);
    try {
      const response = await api.post('/chat/message', {
        conversationId,
        message: content
      });
      setMessages(prev => [...prev, response.data]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  return { messages, sendMessage, loading };
};
```

#### Step 4: Use in Component

```typescript
const ChatWidget: React.FC<ChatWidgetProps> = ({ conversationId }) => {
  const { messages, sendMessage, loading } = useChat(conversationId);

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello')} disabled={loading}>
        Send
      </button>
    </div>
  );
};
```

---

## Database Development

### Creating a Migration

```bash
# Generate migration
cd backend
alembic revision --autogenerate -m "Add new column"

# Review migration file
cat alembic/versions/001_add_new_column.py

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Migration Example

```python
# alembic/versions/001_add_new_column.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('messages', sa.Column('edited', sa.Boolean(), default=False))

def downgrade():
    op.drop_column('messages', 'edited')
```

---

## Testing

### Backend Testing

```python
# backend/tests/test_chat.py
import pytest
from app.services.chat_service import ChatService

@pytest.fixture
def chat_service():
    return ChatService()

@pytest.mark.asyncio
async def test_send_message(chat_service):
    response = await chat_service.process_message({
        "conversationId": "test_123",
        "message": "Hello"
    })
    assert response is not None
    assert "content" in response
```

### Frontend Testing

```typescript
// client/src/components/__tests__/ChatWidget.test.tsx
import { render, screen } from '@testing-library/react';
import { ChatWidget } from '../ChatWidget';

describe('ChatWidget', () => {
  it('renders chat widget', () => {
    render(<ChatWidget conversationId="test_123" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

### Run Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd client
npm test
```

---

## Code Quality

### Linting

```bash
# Backend (Python)
cd backend
flake8 app/
black app/

# Frontend (TypeScript)
cd client
npm run lint
npm run format
```

### Type Checking

```bash
# Backend
mypy app/

# Frontend
npm run type-check
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Setup hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

---

## Debugging

### Backend Debugging

```python
# Using print statements
print(f"Debug: {variable}")

# Using logging
import logging
logger = logging.getLogger(__name__)
logger.info(f"Info: {variable}")
logger.error(f"Error: {variable}")

# Using debugger
import pdb
pdb.set_trace()
```

### Frontend Debugging

```typescript
// Console logging
console.log('Debug:', variable);
console.error('Error:', error);

// Browser DevTools
// F12 or Ctrl+Shift+I to open DevTools
// Set breakpoints in Sources tab
```

### API Debugging

```bash
# Using curl
curl -X POST http://localhost:8000/api/v1/chat/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"test","message":"hello"}'

# Using Postman
# Import API collection and test endpoints
```

---

## Common Tasks

### Add New LLM Provider

```python
# backend/app/services/llm_service.py
class LLMService:
    async def generate_response(self, message: str, model: str):
        if model == "gemini-2.5-flash":
            return await self.gemini_client.generate(message)
        elif model == "claude-3.5-sonnet":
            return await self.anthropic_client.generate(message)
        # Add new provider
        elif model == "new-model":
            return await self.new_provider_client.generate(message)
```

### Add New Database Table

```python
# backend/app/models/new_table.py
from app.database.base import Base
from sqlalchemy import Column, String, DateTime

class NewTable(Base):
    __tablename__ = "new_table"
    
    id = Column(String, primary_key=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Add New Frontend Page

```typescript
// client/src/pages/NewPage.tsx
import React from 'react';

export const NewPage: React.FC = () => {
  return <div>New Page</div>;
};

// client/src/App.tsx
import { NewPage } from '@/pages/NewPage';

function App() {
  return (
    <Routes>
      <Route path="/new-page" element={<NewPage />} />
    </Routes>
  );
}
```

---

## Useful Commands

```bash
# Backend
python main.py                    # Start server
pytest                           # Run tests
black app/                       # Format code
flake8 app/                      # Lint code
alembic upgrade head             # Apply migrations

# Frontend
npm run dev                      # Start dev server
npm test                         # Run tests
npm run build                    # Build for production
npm run lint                     # Lint code
npm run format                   # Format code

# Git
git status                       # Check status
git add .                        # Stage changes
git commit -m "message"          # Commit
git push                         # Push to remote
git pull                         # Pull from remote
```

---

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
