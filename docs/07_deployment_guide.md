# 07_deployment_guide

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Local Development Deployment](#local-development-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Database Setup](#database-setup)
7. [Environment Configuration](#environment-configuration)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring & Logging](#monitoring--logging)
10. [Scaling & Performance](#scaling--performance)

---

## Deployment Overview

### Deployment Strategies

| Strategy | Best For | Complexity | Cost |
| --- | --- | --- | --- |
| **Local Development** | Development & Testing | Low | Free |
| **Docker Compose** | Staging & Small Production | Low-Medium | Low |
| **Kubernetes** | Production & Scaling | High | Medium-High |
| **Managed Services** | Enterprise & High Availability | Medium | High |

### Recommended Deployment Path

```
Development (Local)
    ↓
Staging (Docker Compose)
    ↓
Production (Kubernetes or Managed Service)
```

---

## Local Development Deployment

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Setup Steps

#### 1. Clone Repository

```bash
git clone https://github.com/chatbot-widget/repo.git
cd chatbot_widget
```

#### 2. Create Virtual Environment

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### 3. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

#### 4. Setup Database

```bash
# Create database
createdb chatbot_widget

# Run migrations
cd ../backend
alembic upgrade head
```

#### 5. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings
# IMPORTANT: Update API keys and database URL
```

#### 6. Start Services

```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Redis (if not running as service)
redis-server
```

### Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Docker Deployment

### Docker Compose (Recommended for Staging)

#### Step 1: Create docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-chatbot_widget}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-chatbot_widget}
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ENVIRONMENT: ${ENVIRONMENT:-development}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: python main.py

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://backend:8000/api/v1
      REACT_APP_WS_URL: ws://backend:8000/ws
    depends_on:
      - backend
    volumes:
      - ./frontend:/app

volumes:
  postgres_data:
```

#### Step 2: Create Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run application
CMD ["python", "main.py"]
```

#### Step 3: Create Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

#### Step 4: Create .env File

```bash
# .env
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=chatbot_widget
SECRET_KEY=your-secret-key-here
JWT_SECRET=your-jwt-secret-here
GOOGLE_API_KEY=your-google-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
ENVIRONMENT=staging
```

#### Step 5: Deploy with Docker Compose

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes
docker-compose down -v
```

### Verify Deployment

```bash
# Check services
docker-compose ps

# Test API
curl http://localhost:8000/health

# Access frontend
open http://localhost:3000
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (local or cloud)
- kubectl installed
- Docker images pushed to registry

### Step 1: Create Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chatbot-widget
```

### Step 2: Create ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chatbot-config
  namespace: chatbot-widget
data:
  ENVIRONMENT: production
  REACT_APP_API_URL: https://api.chatbot-widget.com/api/v1
  REACT_APP_WS_URL: wss://api.chatbot-widget.com/ws
```

### Step 3: Create Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: chatbot-secrets
  namespace: chatbot-widget
type: Opaque
stringData:
  DATABASE_URL: postgresql://user:password@postgres:5432/chatbot_widget
  REDIS_URL: redis://redis:6379/0
  SECRET_KEY: your-secret-key
  JWT_SECRET: your-jwt-secret
  GOOGLE_API_KEY: your-google-api-key
  OPENAI_API_KEY: your-openai-api-key
  ANTHROPIC_API_KEY: your-anthropic-api-key
```

### Step 4: Create PostgreSQL Deployment

```yaml
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: chatbot-widget
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: chatbot-widget
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: chatbot-widget
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Step 5: Create Backend Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: chatbot-widget
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/chatbot-widget-backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: chatbot-config
        - secretRef:
            name: chatbot-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: chatbot-widget
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
  type: LoadBalancer
```

### Step 6: Create Frontend Deployment

```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: chatbot-widget
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/chatbot-widget-frontend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: chatbot-config
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: chatbot-widget
spec:
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

### Step 7: Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy services
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Check deployment status
kubectl get deployments -n chatbot-widget
kubectl get pods -n chatbot-widget
kubectl get services -n chatbot-widget

# View logs
kubectl logs -n chatbot-widget -f deployment/backend

# Port forward for testing
kubectl port-forward -n chatbot-widget svc/backend 8000:8000
kubectl port-forward -n chatbot-widget svc/frontend 3000:3000
```

---

## Cloud Deployment

### AWS Deployment (ECS)

#### Step 1: Create ECR Repositories

```bash
# Create repositories
aws ecr create-repository --repository-name chatbot-widget-backend
aws ecr create-repository --repository-name chatbot-widget-frontend

# Push images
docker tag chatbot-widget-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/chatbot-widget-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/chatbot-widget-backend:latest
```

#### Step 2: Create RDS Database

```bash
# Create PostgreSQL RDS instance
aws rds create-db-instance \
  --db-instance-identifier chatbot-widget-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password <password> \
  --allocated-storage 20
```

#### Step 3: Create ElastiCache Redis

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id chatbot-widget-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

#### Step 4: Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster --cluster-name chatbot-widget

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster chatbot-widget \
  --service-name backend \
  --task-definition chatbot-widget-backend \
  --desired-count 3
```

### Google Cloud Deployment (Cloud Run)

#### Step 1: Build and Push Images

```bash
# Build backend
gcloud builds submit --tag gcr.io/PROJECT_ID/chatbot-widget-backend ./backend

# Build frontend
gcloud builds submit --tag gcr.io/PROJECT_ID/chatbot-widget-frontend ./frontend
```

#### Step 2: Deploy Backend

```bash
gcloud run deploy chatbot-widget-backend \
  --image gcr.io/PROJECT_ID/chatbot-widget-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=<db_url>,REDIS_URL=<redis_url> \
  --memory 512Mi \
  --cpu 1
```

#### Step 3: Deploy Frontend

```bash
gcloud run deploy chatbot-widget-frontend \
  --image gcr.io/PROJECT_ID/chatbot-widget-frontend \
  --platform managed \
  --region us-central1 \
  --set-env-vars REACT_APP_API_URL=<backend_url> \
  --memory 256Mi
```

### Azure Deployment (App Service)

#### Step 1: Create Resource Group

```bash
az group create --name chatbot-widget --location eastus
```

#### Step 2: Create App Service Plan

```bash
az appservice plan create \
  --name chatbot-widget-plan \
  --resource-group chatbot-widget \
  --sku B2 \
  --is-linux
```

#### Step 3: Deploy Backend

```bash
az webapp create \
  --resource-group chatbot-widget \
  --plan chatbot-widget-plan \
  --name chatbot-widget-backend \
  --runtime "PYTHON|3.11"

# Configure deployment
az webapp deployment source config-zip \
  --resource-group chatbot-widget \
  --name chatbot-widget-backend \
  --src backend.zip
```

#### Step 4: Deploy Frontend

```bash
az webapp create \
  --resource-group chatbot-widget \
  --plan chatbot-widget-plan \
  --name chatbot-widget-frontend \
  --runtime "NODE|18-lts"

# Configure deployment
az webapp deployment source config-zip \
  --resource-group chatbot-widget \
  --name chatbot-widget-frontend \
  --src frontend.zip
```

---

## Database Setup

### PostgreSQL Setup

```sql
-- Create database
CREATE DATABASE chatbot_widget;

-- Create user
CREATE USER chatbot_user WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE chatbot_widget TO chatbot_user;

-- Connect to database
\c chatbot_widget

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Run migrations
-- (Using Alembic or similar tool)
```

### Redis Setup

```bash
# Start Redis
redis-server

# Test connection
redis-cli ping

# Configure persistence
# Edit redis.conf:
# save 900 1
# save 300 10
# save 60 10000
```

---

## Environment Configuration

### Development Environment

```bash
ENVIRONMENT=development
DEBUG=True
LOG_LEVEL=DEBUG
DATABASE_URL=postgresql://localhost/chatbot_widget
REDIS_URL=redis://localhost:6379/0
```

### Staging Environment

```bash
ENVIRONMENT=staging
DEBUG=False
LOG_LEVEL=INFO
DATABASE_URL=postgresql://user:pass@staging-db.example.com/chatbot_widget
REDIS_URL=redis://staging-redis.example.com:6379/0
```

### Production Environment

```bash
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=WARNING
DATABASE_URL=postgresql://user:pass@prod-db.example.com/chatbot_widget
REDIS_URL=redis://prod-redis.example.com:6379/0
CORS_ORIGINS=https://chatbot-widget.com
```

---

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest
          
          cd ../frontend
          npm install
          npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build and push Docker images
        run: |
          docker build -t backend:latest ./backend
          docker build -t frontend:latest ./frontend
          docker push backend:latest
          docker push frontend:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/backend -n chatbot-widget
```

---

## Monitoring & Logging

### Prometheus Metrics

```python
# backend/app/middleware/metrics.py
from prometheus_client import Counter, Histogram

request_count = Counter('http_requests_total', 'Total HTTP requests')
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
# docker-compose.yml (add to existing)
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
  environment:
    - discovery.type=single-node

kibana:
  image: docker.elastic.co/kibana/kibana:8.0.0
  ports:
    - "5601:5601"
```

### Application Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
```

---

## Scaling & Performance

### Horizontal Scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: chatbot-widget
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Caching Strategy

```python
# Redis caching
from redis import Redis

redis_client = Redis(host='localhost', port=6379, db=0)

def get_cached_response(key):
    return redis_client.get(key)

def set_cached_response(key, value, ttl=3600):
    redis_client.setex(key, ttl, value)
```

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_conversation_user_id ON conversations(user_id);
CREATE INDEX idx_message_conversation_id ON messages(conversation_id);
CREATE INDEX idx_message_created_at ON messages(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM messages WHERE conversation_id = 'conv_123';
```

---

## Troubleshooting

### Common Issues

**Issue**: Database connection timeout
```bash
# Solution: Check database is running
psql -U postgres -h localhost -d chatbot_widget

# Check connection string
echo $DATABASE_URL
```

**Issue**: Redis connection error
```bash
# Solution: Check Redis is running
redis-cli ping

# Check Redis URL
echo $REDIS_URL
```

**Issue**: Docker image build fails
```bash
# Solution: Check Dockerfile
docker build --no-cache -t backend:latest ./backend

# View build logs
docker build -t backend:latest ./backend 2>&1 | tail -50
```

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] API keys configured
- [ ] SSL certificates installed
- [ ] Backups configured
- [ ] Monitoring setup
- [ ] Logging configured
- [ ] Health checks working
- [ ] Load balancer configured
- [ ] DNS records updated
- [ ] Security groups configured
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] CDN configured (if needed)
- [ ] Disaster recovery plan

---

## Support

For deployment issues, refer to:
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [React Deployment](https://react.dev/learn/deployment)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
