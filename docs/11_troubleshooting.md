# 11_trouble_shooting

## Table of Contents

1. [Common Backend Issues](#common-backend-issues)
2. [Common Frontend Issues](#common-frontend-issues)
3. [Database Issues](#database-issues)
4. [API Issues](#api-issues)
5. [Deployment Issues](#deployment-issues)
6. [Performance Issues](#performance-issues)
7. [Security Issues](#security-issues)
8. [Debugging Tools](#debugging-tools)
9. [Getting Help](#getting-help)

---

## Common Backend Issues

### Issue: "ModuleNotFoundError: No module named 'app'"

**Cause**: Python path not configured correctly

**Solution**:

```bash
# Ensure you're in the backend directory
cd backend

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run from project root
python -m app.main
```

### Issue: "Connection refused" on port 8000

**Cause**: Backend server not running or port already in use

**Solution**:

```bash
# Check if port is in use
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process using port
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Start backend
python main.py
```

### Issue: "CORS error: Access-Control-Allow-Origin"

**Cause**: Frontend and backend have different origins

**Solution**:

```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: "Database connection timeout"

**Cause**: PostgreSQL not running or connection string incorrect

**Solution**:

```bash
# Check PostgreSQL is running
psql --version

# Test connection
psql -U postgres -h localhost -d chatbot_widget

# Check connection string
echo $DATABASE_URL

# Verify credentials
# DATABASE_URL=postgresql://user:password@host:5432/database
```

### Issue: "Redis connection refused"

**Cause**: Redis server not running

**Solution**:

```bash
# Start Redis
redis-server

# Test connection
redis-cli ping
# Should return: PONG

# Check Redis URL
echo $REDIS_URL
# Should be: redis://localhost:6379/0
```

### Issue: "JWT token expired"

**Cause**: Access token has expired

**Solution**:

```python
# Check token expiration
import jwt
from datetime import datetime

token = "your_token_here"
decoded = jwt.decode(token, "secret", algorithms=["HS256"])
exp_timestamp = decoded.get("exp")
exp_datetime = datetime.fromtimestamp(exp_timestamp)
print(f"Token expires at: {exp_datetime}")

# Use refresh token to get new access token
POST /api/v1/auth/refresh
{
  "refreshToken": "your_refresh_token"
}
```

### Issue: "LLM API key not found"

**Cause**: Environment variable not set

**Solution**:

```bash
# Check environment variables
echo $GOOGLE_API_KEY
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Set in .env file
GOOGLE_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Reload environment
source .env  # macOS/Linux
# Windows: No direct source, restart terminal or IDE
```

---

## Common Frontend Issues

### Issue: "Blank white screen"

**Cause**: React app failed to mount

**Solution**:

```bash
# Check browser console (F12)
# Look for errors

# Clear cache and rebuild
rm -rf node_modules
npm install
npm run dev

# Check if backend is running
curl http://localhost:8000/health
```

### Issue: "Cannot find module '@/components'"

**Cause**: Path alias not configured

**Solution**:

```typescript
// client/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

// client/vite.config.ts
import react from '@vitejs/plugin-react'
import path from 'path'

export default {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}
```

### Issue: "API call returns 404"

**Cause**: Backend endpoint not found or wrong URL

**Solution**:

```typescript
// Check API URL
console.log(import.meta.env.VITE_API_URL);

// Verify endpoint exists
curl http://localhost:8000/api/v1/health

// Check frontend service
// client/src/services/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
```

### Issue: "WebSocket connection failed"

**Cause**: WebSocket server not running or wrong URL

**Solution**:

```typescript
// Check WebSocket URL
console.log(import.meta.env.VITE_WS_URL);

// Verify WebSocket endpoint
// Should be: ws://localhost:8000/ws

// Test connection
const ws = new WebSocket('ws://localhost:8000/ws?token=<token>');
ws.onopen = () => console.log('Connected');
ws.onerror = (err) => console.error('Error:', err);
```

### Issue: "State not updating"

**Cause**: React state mutation or missing dependency

**Solution**:

```typescript
// ❌ Bad: Direct mutation
state.items.push(newItem);

// ✅ Good: Create new array
setState([...state.items, newItem]);

// ❌ Bad: Missing dependency
useEffect(() => {
  fetchData();
}, []);  // Missing dependency

// ✅ Good: Include dependencies
useEffect(() => {
  fetchData();
}, [userId]);  // Include userId
```

### Issue: "Infinite loop in useEffect"

**Cause**: Missing or incorrect dependencies

**Solution**:

```typescript
// ❌ Bad: Infinite loop
useEffect(() => {
  setData([...data, newItem]);  // data changes, triggers effect again
}, []);

// ✅ Good: Correct dependencies
useEffect(() => {
  setData([...data, newItem]);
}, [newItem]);  // Only run when newItem changes
```

---

## Database Issues

### Issue: "Database does not exist"

**Cause**: Database not created

**Solution**:

```bash
# Create database
createdb chatbot_widget

# Or using psql
psql -U postgres
CREATE DATABASE chatbot_widget;
```

### Issue: "Migration failed"

**Cause**: Migration script has errors

**Solution**:

```bash
# Check migration status
alembic current

# View pending migrations
alembic upgrade --sql head

# Rollback last migration
alembic downgrade -1

# Upgrade to latest
alembic upgrade head

# Check migration history
alembic history
```

### Issue: "Foreign key constraint violation"

**Cause**: Trying to delete record that has references

**Solution**:

```sql
-- Check foreign keys
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'messages';

-- Delete referencing records first
DELETE FROM messages WHERE conversation_id = 'conv_123';
DELETE FROM conversations WHERE id = 'conv_123';

-- Or use CASCADE delete (careful!)
ALTER TABLE messages
DROP CONSTRAINT messages_conversation_id_fk,
ADD CONSTRAINT messages_conversation_id_fk
FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
```

### Issue: "Slow database queries"

**Cause**: Missing indexes or inefficient queries

**Solution**:

```sql
-- Create indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM messages WHERE conversation_id = 'conv_123';

-- Check index usage
SELECT * FROM pg_stat_user_indexes;
```

### Issue: "Disk space full"

**Cause**: Database or logs consuming too much space

**Solution**:

```bash
# Check disk usage
df -h

# Check PostgreSQL data directory size
du -sh /var/lib/postgresql/

# Vacuum database
psql -U postgres -d chatbot_widget -c "VACUUM ANALYZE;"

# Delete old logs
rm -rf /var/log/postgresql/*.log
```

---

## API Issues

### Issue: "401 Unauthorized"

**Cause**: Missing or invalid authentication token

**Solution**:

```bash
# Get new token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Use token in requests
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/conversations
```

### Issue: "429 Too Many Requests"

**Cause**: Rate limit exceeded

**Solution**:

```python
# Check rate limit headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890

# Wait before retrying
import time
time.sleep(60)  # Wait 60 seconds

# Implement exponential backoff
for attempt in range(3):
    try:
        response = make_request()
        break
    except RateLimitError:
        wait_time = 2 ** attempt
        time.sleep(wait_time)
```

### Issue: "500 Internal Server Error"

**Cause**: Backend error

**Solution**:

```bash
# Check backend logs
tail -f backend/logs/app.log

# Check error details
curl -v http://localhost:8000/api/v1/endpoint

# Enable debug mode
DEBUG=True python main.py

# Check for exceptions
try:
    result = process_request()
except Exception as e:
    logger.error(f"Error: {e}", exc_info=True)
```

### Issue: "Timeout on file upload"

**Cause**: File too large or network slow

**Solution**:

```python
# Increase timeout
import requests

response = requests.post(
    url,
    files=files,
    timeout=300  # 5 minutes
)

# Or in FastAPI
from fastapi import UploadFile

@app.post("/upload")
async def upload(file: UploadFile):
    # FastAPI has default timeout
    # Increase in deployment config
    pass

# Implement chunked upload
# Split large file into chunks
# Upload each chunk separately
# Combine on server
```

---

## Deployment Issues

### Issue: "Docker build fails"

**Cause**: Dockerfile errors or missing dependencies

**Solution**:

```bash
# Build with verbose output
docker build --no-cache -t backend:latest ./backend 2>&1 | tail -50

# Check Dockerfile syntax
docker run --rm -i hadolint/hadolint < Dockerfile

# Build specific stage
docker build --target builder -t backend:latest ./backend
```

### Issue: "Container exits immediately"

**Cause**: Application crash or wrong entrypoint

**Solution**:

```bash
# Check logs
docker logs <container_id>

# Run with interactive terminal
docker run -it backend:latest /bin/bash

# Check entrypoint
docker inspect backend:latest | grep -A 5 Entrypoint

# Verify command
docker run backend:latest python main.py
```

### Issue: "Kubernetes pod not starting"

**Cause**: Image not found, resource limits, or config error

**Solution**:

```bash
# Check pod status
kubectl describe pod <pod_name> -n chatbot-widget

# Check events
kubectl get events -n chatbot-widget

# Check logs
kubectl logs <pod_name> -n chatbot-widget

# Check resource availability
kubectl top nodes
kubectl top pods -n chatbot-widget

# Check image
kubectl get pods -n chatbot-widget -o jsonpath='{.items[0].spec.containers[0].image}'
```

### Issue: "Service not accessible"

**Cause**: Service misconfigured or networking issue

**Solution**:

```bash
# Check service
kubectl get svc -n chatbot-widget

# Check endpoints
kubectl get endpoints -n chatbot-widget

# Port forward for testing
kubectl port-forward -n chatbot-widget svc/backend 8000:8000

# Check network policies
kubectl get networkpolicies -n chatbot-widget

# Test connectivity
kubectl run -it --rm debug --image=alpine --restart=Never -- \
  wget -O- http://backend:8000/health
```

---

## Performance Issues

### Issue: "High CPU usage"

**Cause**: Inefficient code or infinite loop

**Solution**:

```python
# Profile code
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Run code
result = process_request()

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)  # Top 10 functions

# Use memory_profiler
from memory_profiler import profile

@profile
def expensive_function():
    # Code here
    pass
```

### Issue: "High memory usage"

**Cause**: Memory leak or large data structures

**Solution**:

```python
# Check memory usage
import psutil
import os

process = psutil.Process(os.getpid())
print(f"Memory: {process.memory_info().rss / 1024 / 1024} MB")

# Use tracemalloc
import tracemalloc

tracemalloc.start()
# Run code
current, peak = tracemalloc.get_traced_memory()
print(f"Current: {current / 1024 / 1024} MB; Peak: {peak / 1024 / 1024} MB")
```

### Issue: "Slow API responses"

**Cause**: Inefficient queries or missing caching

**Solution**:

```python
# Add caching
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_operation(param):
    # Expensive computation
    return result

# Or use Redis
import redis

redis_client = redis.Redis()

def get_data(key):
    # Check cache
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    
    # Fetch from DB
    data = fetch_from_db(key)
    
    # Cache result
    redis_client.setex(key, 3600, json.dumps(data))
    return data
```

---

## Security Issues

### Issue: "SQL Injection vulnerability"

**Cause**: String concatenation in queries

**Solution**:

```python
# ❌ Bad
query = f"SELECT * FROM users WHERE id = {user_id}"

# ✅ Good
from sqlalchemy import text
query = text("SELECT * FROM users WHERE id = :user_id")
result = db.execute(query, {"user_id": user_id})
```

### Issue: "XSS vulnerability"

**Cause**: Rendering unsanitized HTML

**Solution**:

```typescript
// ❌ Bad
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Good
<div>{userInput}</div>  // React escapes automatically

// Or sanitize
import DOMPurify from 'dompurify';
<div>{DOMPurify.sanitize(userInput)}</div>
```

### Issue: "Exposed API keys"

**Cause**: Secrets committed to git

**Solution**:

```bash
# Remove from git history
git filter-branch --tree-filter 'rm -f .env' HEAD

# Or use git-secrets
git secrets --install
git secrets --register-aws

# Rotate keys
# Generate new API keys
# Update in .env
# Restart application
```

---

## Debugging Tools

### Backend Debugging

```python
# Print debugging
print(f"Debug: {variable}")

# Logging
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Debug: {variable}")

# Debugger
import pdb
pdb.set_trace()

# Or use ipdb for better interface
import ipdb
ipdb.set_trace()
```

### Frontend Debugging

```typescript
// Console logging
console.log('Debug:', variable);
console.error('Error:', error);
console.table(data);

// Browser DevTools
// F12 or Ctrl+Shift+I

// React DevTools
// Browser extension for React debugging

// Network tab
// Check API requests and responses
```

### Database Debugging

```bash
# Connect to database
psql -U postgres -d chatbot_widget

# List tables
\dt

# Describe table
\d messages

# Run query
SELECT * FROM messages LIMIT 10;

# Explain query
EXPLAIN ANALYZE SELECT * FROM messages WHERE conversation_id = 'conv_123';
```

---

## Getting Help

### Resources

- **Documentation**: https://docs.chatbot-widget.com
- **GitHub Issues**: https://github.com/chatbot-widget/repo/issues
- **Discord Community**: https://discord.gg/chatbot-widget
- **Email Support**: support@chatbot-widget.com

### Reporting Issues

When reporting issues, include:

1. **Environment**
   - OS and version
   - Python/Node version
   - Browser (if frontend issue)

2. **Steps to Reproduce**
   - Exact steps to reproduce
   - Expected behavior
   - Actual behavior

3. **Logs**
   - Error messages
   - Stack traces
   - Relevant log entries

4. **Minimal Example**
   - Minimal code to reproduce
   - Sample data
   - Configuration

### Example Issue Report

```
Title: Chat widget not loading on Windows 11

Environment:
- OS: Windows 11
- Python: 3.11.0
- Node: 18.14.0
- Browser: Chrome 120

Steps to Reproduce:
1. Start backend: python main.py
2. Start frontend: npm run dev
3. Open http://localhost:5173
4. Click chat widget

Expected: Chat widget loads
Actual: Blank white screen

Logs:
```
[Error] Failed to load resource: the server responded with a status of 404
```

Minimal Example:
```typescript
// client/src/App.tsx
import { ChatWidget } from '@/components/ChatWidget';

export default function App() {
  return <ChatWidget conversationId="test_123" />;
}
```
```

---

## Troubleshooting Checklist

- [ ] Check error messages in logs
- [ ] Verify environment variables are set
- [ ] Confirm services are running (backend, database, Redis)
- [ ] Check network connectivity
- [ ] Verify API endpoints are correct
- [ ] Clear cache and rebuild
- [ ] Check browser console for errors
- [ ] Verify authentication tokens
- [ ] Check database connections
- [ ] Review recent changes
- [ ] Search documentation
- [ ] Check GitHub issues
- [ ] Ask in community forums
- [ ] Contact support with detailed info
