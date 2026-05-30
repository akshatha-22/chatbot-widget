# Build the Vite widget from repo root:
#   docker build -f docker/client.Dockerfile -t chatbot-widget-client:latest .
#
# Override API URL baked into the bundle (production):
#   docker build --build-arg VITE_API_URL=https://api.example.com ...

FROM node:20-alpine AS build
WORKDIR /app

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:alpine
COPY docker/nginx.client.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
