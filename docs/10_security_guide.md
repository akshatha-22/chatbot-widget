# 10_security_guide

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)
7. [Test Coverage](#test-coverage)
8. [Continuous Testing](#continuous-testing)
9. [Test Data Management](#test-data-management)
10. [Testing Best Practices](#testing-best-practices)

---

## Testing Overview

### Testing Pyramid

```
        /\
       /  \
      / E2E \
     /______\
    /        \
   /Integration\
  /____________\
 /              \
/    Unit Tests  \
/________________\
```

### Test Distribution

- **Unit Tests**: 70% (Fast, isolated)
- **Integration Tests**: 20% (Services, database)
- **E2E Tests**: 10% (Full workflows)

### Testing Tools

| Layer | Tool | Purpose |
| --- | --- | --- |
| **Unit** | pytest (Backend), Jest (Frontend) | Test individual functions |
| **Integration** | pytest, pytest-asyncio | Test service interactions |
| **E2E** | Cypress, Playwright | Test full user workflows |
| **Performance** | Locust, Apache JMeter | Load and stress testing |
| **Security** | OWASP ZAP, Bandit | Vulnerability scanning |

---

## Unit Testing

### Backend Unit Tests

#### Test Structure

```python
# backend/tests/test_chat_service.py
import pytest
from app.services.chat_service import ChatService
from app.schemas.chat import MessageRequest

@pytest.fixture
def chat_service():
    """Fixture for ChatService instance"""
    return ChatService()

@pytest.fixture
def mock_llm_response():
    """Fixture for mock LLM response"""
    return {
        "content": "This is a test response",
        "tokens": {"input": 10, "output": 20}
    }

class TestChatService:
    """Test suite for ChatService"""
    
    @pytest.mark.asyncio
    async def test_process_message_success(self, chat_service, mock_llm_response):
        """Test successful message processing"""
        request = MessageRequest(
            conversationId="test_123",
            message="Hello",
            model="gemini-2.5-flash"
        )
        
        # Mock the LLM service
        chat_service.llm_service.generate_response = AsyncMock(
            return_value=mock_llm_response
        )
        
        response = await chat_service.process_message(request)
        
        assert response is not None
        assert response["content"] == "This is a test response"
        assert response["tokens"]["input"] == 10
    
    @pytest.mark.asyncio
    async def test_process_message_invalid_input(self, chat_service):
        """Test message processing with invalid input"""
        request = MessageRequest(
            conversationId="",  # Invalid: empty ID
            message="Hello",
            model="gemini-2.5-flash"
        )
        
        with pytest.raises(ValueError):
            await chat_service.process_message(request)
    
    @pytest.mark.asyncio
    async def test_process_message_llm_error(self, chat_service):
        """Test message processing when LLM fails"""
        request = MessageRequest(
            conversationId="test_123",
            message="Hello",
            model="invalid-model"
        )
        
        chat_service.llm_service.generate_response = AsyncMock(
            side_effect=Exception("LLM API error")
        )
        
        with pytest.raises(Exception):
            await chat_service.process_message(request)
```

#### Running Backend Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_chat_service.py

# Run specific test
pytest tests/test_chat_service.py::TestChatService::test_process_message_success

# Run with coverage
pytest --cov=app tests/

# Run with verbose output
pytest -v

# Run with markers
pytest -m "asyncio"
```

### Frontend Unit Tests

#### Test Structure

```typescript
// client/src/components/__tests__/ChatWidget.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatWidget } from '../ChatWidget';

describe('ChatWidget', () => {
  it('renders chat widget', () => {
    render(<ChatWidget conversationId="test_123" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('sends message on button click', async () => {
    const mockSendMessage = jest.fn();
    render(<ChatWidget conversationId="test_123" onSendMessage={mockSendMessage} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Hello');
    });
  });

  it('displays error message on API failure', async () => {
    const mockSendMessage = jest.fn().mockRejectedValue(new Error('API error'));
    render(<ChatWidget conversationId="test_123" onSendMessage={mockSendMessage} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('displays loading state while sending', async () => {
    const mockSendMessage = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
    render(<ChatWidget conversationId="test_123" onSendMessage={mockSendMessage} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(button);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

#### Running Frontend Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test ChatWidget.test.tsx

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run with specific reporter
npm test -- --reporters=verbose
```

---

## Integration Testing

### Backend Integration Tests

```python
# backend/tests/integration/test_chat_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_send_message_integration(db_session, auth_token):
    """Test full message sending workflow"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create conversation
        conv_response = await client.post(
            "/api/v1/conversations",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Test Conversation"}
        )
        conversation_id = conv_response.json()["data"]["conversationId"]
        
        # Send message
        msg_response = await client.post(
            "/api/v1/chat/message",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "conversationId": conversation_id,
                "message": "Hello",
                "model": "gemini-2.5-flash"
            }
        )
        
        assert msg_response.status_code == 200
        assert msg_response.json()["success"] is True
        assert "messageId" in msg_response.json()["data"]

@pytest.mark.asyncio
async def test_file_upload_integration(db_session, auth_token):
    """Test file upload and processing"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create conversation
        conv_response = await client.post(
            "/api/v1/conversations",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Test Conversation"}
        )
        conversation_id = conv_response.json()["data"]["conversationId"]
        
        # Upload file
        with open("test_document.pdf", "rb") as f:
            file_response = await client.post(
                "/api/v1/files/upload",
                headers={"Authorization": f"Bearer {auth_token}"},
                files={"file": f},
                data={"conversationId": conversation_id}
            )
        
        assert file_response.status_code == 200
        assert file_response.json()["data"]["status"] == "processing"
```

### Database Integration Tests

```python
# backend/tests/integration/test_database.py
import pytest
from app.models.message import Message
from app.database.session import get_db

@pytest.mark.asyncio
async def test_message_creation(db_session):
    """Test message creation in database"""
    message = Message(
        id="msg_123",
        conversation_id="conv_123",
        role="user",
        content="Hello"
    )
    
    db_session.add(message)
    db_session.commit()
    
    # Verify message was created
    retrieved = db_session.query(Message).filter(
        Message.id == "msg_123"
    ).first()
    
    assert retrieved is not None
    assert retrieved.content == "Hello"
```

---

## End-to-End Testing

### Cypress Tests

```typescript
// client/cypress/e2e/chat.cy.ts
describe('Chat Widget E2E Tests', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
    cy.login('test@example.com', 'password123');
  });

  it('should send a message and receive response', () => {
    // Click on chat widget
    cy.get('[data-testid="chat-widget"]').click();
    
    // Type message
    cy.get('[data-testid="message-input"]').type('What is AI?');
    
    // Send message
    cy.get('[data-testid="send-button"]').click();
    
    // Verify message appears
    cy.get('[data-testid="message-user"]').should('contain', 'What is AI?');
    
    // Wait for response
    cy.get('[data-testid="message-assistant"]', { timeout: 10000 })
      .should('be.visible')
      .should('not.be.empty');
  });

  it('should upload and analyze file', () => {
    cy.get('[data-testid="chat-widget"]').click();
    
    // Upload file
    cy.get('[data-testid="file-input"]').attachFile('document.pdf');
    
    // Wait for upload
    cy.get('[data-testid="file-status"]').should('contain', 'Uploaded');
    
    // Send message about file
    cy.get('[data-testid="message-input"]').type('Summarize this document');
    cy.get('[data-testid="send-button"]').click();
    
    // Verify response
    cy.get('[data-testid="message-assistant"]', { timeout: 10000 })
      .should('be.visible');
  });

  it('should edit message before sending', () => {
    cy.get('[data-testid="chat-widget"]').click();
    
    // Type message
    cy.get('[data-testid="message-input"]').type('What is AI?');
    
    // Click edit button
    cy.get('[data-testid="edit-button"]').click();
    
    // Clear and type new message
    cy.get('[data-testid="message-input"]').clear().type('What is Machine Learning?');
    
    // Send
    cy.get('[data-testid="send-button"]').click();
    
    // Verify edited message
    cy.get('[data-testid="message-user"]').should('contain', 'What is Machine Learning?');
  });

  it('should view conversation history', () => {
    // Navigate to dashboard
    cy.get('[data-testid="dashboard-link"]').click();
    
    // Verify conversations list
    cy.get('[data-testid="conversations-list"]').should('be.visible');
    
    // Click on conversation
    cy.get('[data-testid="conversation-item"]').first().click();
    
    // Verify messages are displayed
    cy.get('[data-testid="message"]').should('have.length.greaterThan', 0);
  });
});
```

#### Running E2E Tests

```bash
# Run Cypress tests
npx cypress run

# Run in interactive mode
npx cypress open

# Run specific test file
npx cypress run --spec "cypress/e2e/chat.cy.ts"

# Run with specific browser
npx cypress run --browser chrome
```

---

## Performance Testing

### Load Testing with Locust

```python
# tests/performance/locustfile.py
from locust import HttpUser, task, between
import random

class ChatbotUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login before starting tasks"""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        self.token = response.json()["data"]["accessToken"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def send_message(self):
        """Send message task (3x frequency)"""
        self.client.post(
            "/api/v1/chat/message",
            headers=self.headers,
            json={
                "conversationId": "conv_123",
                "message": "Hello",
                "model": "gemini-2.5-flash"
            }
        )
    
    @task(1)
    def get_conversations(self):
        """Get conversations task (1x frequency)"""
        self.client.get(
            "/api/v1/conversations",
            headers=self.headers
        )
    
    @task(1)
    def upload_file(self):
        """Upload file task (1x frequency)"""
        with open("test_document.pdf", "rb") as f:
            self.client.post(
                "/api/v1/files/upload",
                headers=self.headers,
                files={"file": f},
                data={"conversationId": "conv_123"}
            )
```

#### Running Performance Tests

```bash
# Run Locust
locust -f tests/performance/locustfile.py --host=http://localhost:8000

# Run with specific number of users
locust -f tests/performance/locustfile.py --host=http://localhost:8000 -u 100 -r 10

# Run headless
locust -f tests/performance/locustfile.py --host=http://localhost:8000 -u 100 -r 10 --headless -t 5m
```

---

## Security Testing

### OWASP ZAP Scanning

```bash
# Install OWASP ZAP
# Download from https://www.zaproxy.org/

# Run baseline scan
zaproxy -cmd -quickurl http://localhost:3000 -quickout report.html

# Run full scan
zaproxy -cmd -url http://localhost:3000 -newsession test -report report.html
```

### Bandit (Python Security)

```bash
# Install Bandit
pip install bandit

# Scan code
bandit -r backend/app/

# Generate report
bandit -r backend/app/ -f json -o bandit-report.json
```

### Manual Security Tests

```python
# Test SQL Injection
# Try: " OR 1=1 --

# Test XSS
# Try: <script>alert('XSS')</script>

# Test CSRF
# Verify CSRF tokens are present

# Test Authentication
# Try accessing endpoints without token

# Test Authorization
# Try accessing other user's data
```

---

## Test Coverage

### Backend Coverage

```bash
# Generate coverage report
pytest --cov=app --cov-report=html tests/

# View report
open htmlcov/index.html

# Set coverage threshold
pytest --cov=app --cov-fail-under=80 tests/
```

### Frontend Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View report
open coverage/lcov-report/index.html
```

### Coverage Goals

| Component | Target |
| --- | --- |
| **Unit Tests** | 80%+ |
| **Integration Tests** | 60%+ |
| **Overall** | 75%+ |

---

## Continuous Testing

### GitHub Actions CI/CD

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run backend tests
        run: |
          cd backend
          pytest --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./backend/coverage.xml
      
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install frontend dependencies
        run: |
          cd client
          npm install
      
      - name: Run frontend tests
        run: |
          cd client
          npm test -- --coverage
      
      - name: Run E2E tests
        run: |
          cd client
          npm run build
          npx cypress run
```

---

## Test Data Management

### Test Fixtures

```python
# backend/tests/conftest.py
import pytest
from app.models.user import User
from app.models.conversation import Conversation

@pytest.fixture
def test_user(db_session):
    """Create test user"""
    user = User(
        id="user_123",
        email="test@example.com",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def test_conversation(db_session, test_user):
    """Create test conversation"""
    conv = Conversation(
        id="conv_123",
        user_id=test_user.id,
        title="Test Conversation"
    )
    db_session.add(conv)
    db_session.commit()
    return conv

@pytest.fixture
def auth_token(test_user):
    """Generate auth token"""
    from app.utils.auth import create_token
    return create_token(test_user.id)
```

### Test Database

```python
# backend/tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="session")
def db():
    """Create test database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine

@pytest.fixture
def db_session(db):
    """Create test session"""
    connection = db.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
```

---

## Testing Best Practices

### 1. Test Naming

```python
# ✅ Good: Clear, descriptive names
def test_send_message_with_valid_input_returns_success():
    pass

# ❌ Bad: Vague names
def test_message():
    pass
```

### 2. Arrange-Act-Assert Pattern

```python
# ✅ Good: Clear structure
def test_calculate_total():
    # Arrange
    items = [10, 20, 30]
    
    # Act
    total = sum(items)
    
    # Assert
    assert total == 60
```

### 3. One Assertion Per Test

```python
# ✅ Good: Single responsibility
def test_user_creation_sets_email():
    user = User(email="test@example.com")
    assert user.email == "test@example.com"

def test_user_creation_sets_name():
    user = User(name="John")
    assert user.name == "John"

# ❌ Bad: Multiple assertions
def test_user_creation():
    user = User(email="test@example.com", name="John")
    assert user.email == "test@example.com"
    assert user.name == "John"
```

### 4. Use Fixtures

```python
# ✅ Good: Reusable fixtures
@pytest.fixture
def user():
    return User(email="test@example.com")

def test_user_email(user):
    assert user.email == "test@example.com"

# ❌ Bad: Repeated setup
def test_user_email():
    user = User(email="test@example.com")
    assert user.email == "test@example.com"
```

### 5. Mock External Dependencies

```python
# ✅ Good: Mock external API
@pytest.mark.asyncio
async def test_send_message(chat_service):
    chat_service.llm_service.generate_response = AsyncMock(
        return_value={"content": "response"}
    )
    result = await chat_service.process_message(...)
    assert result is not None

# ❌ Bad: Calling real API
@pytest.mark.asyncio
async def test_send_message(chat_service):
    result = await chat_service.process_message(...)  # Calls real API
    assert result is not None
```

---

## Testing Checklist

- [ ] Unit tests written for all services
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Performance tests for scalability
- [ ] Security tests for vulnerabilities
- [ ] Test coverage > 75%
- [ ] All tests passing
- [ ] CI/CD pipeline configured
- [ ] Test data properly managed
- [ ] Mocks used for external dependencies

---

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Locust Documentation](https://locust.io/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
