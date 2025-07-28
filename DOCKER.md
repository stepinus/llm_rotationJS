# 🐳 Docker Deployment Guide

This guide covers Docker deployment options for the LLM Rotation Server.

## 📋 Prerequisites

- Docker installed and running
- Docker Compose (optional, but recommended)
- API keys for your chosen LLM providers

## 🚀 Quick Start

### 1. Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd llm-rotation-server

# Set your API keys in docker-compose.yml or use environment variables
export OPENROUTER_API_KEY=your_key_here
export GEMINI_API_KEY=your_key_here

# Start the service
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### 2. Using Docker directly

```bash
# Build the image
docker build -t llm-rotation-server .

# Run the container
docker run -d \
  --name llm-rotation-server \
  -p 3000:3000 \
  -e OPENROUTER_API_KEY=your_key_here \
  -e GEMINI_API_KEY=your_key_here \
  --restart unless-stopped \
  llm-rotation-server

# Check logs
docker logs -f llm-rotation-server
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `OPENROUTER_API_KEY` | OpenRouter API key(s) | `key1,key2,key3` |
| `GEMINI_API_KEY` | Google Gemini API key(s) | `key1,key2` |
| `HUGGINGFACE_API_KEY` | Hugging Face API key(s) | `hf_token` |
| `MISTRAL_API_KEY` | Mistral AI API key(s) | `mistral_key` |
| `COHERE_API_KEY` | Cohere API key(s) | `cohere_key` |
| `NVIDIA_API_KEY` | NVIDIA API key(s) | `nvapi_key` |
| `CHUTES_API_KEY` | Chutes AI API key(s) | `chutes_key` |
| `REQUESTY_API_KEY` | Requesty API key(s) | `requesty_key` |

### Multiple API Keys

For key rotation, provide multiple keys separated by commas:

```bash
export OPENROUTER_API_KEY=key1,key2,key3
export GEMINI_API_KEY=key1,key2
```

## 🏗️ Build Options

### Development Build

```bash
# Standard build (includes dev dependencies during build)
docker build -t llm-rotation-server .
```

### Production Build

```bash
# Multi-stage build (smaller final image)
docker build -f Dockerfile.prod -t llm-rotation-server:prod .
```

### Build Script

```bash
# Use the provided build script
./docker-build.sh
```

## 🔍 Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps

# Manual health check
docker exec llm-rotation-server node healthcheck.js
```

Health check endpoint: `GET /health`

## 📊 Monitoring

### Container Logs

```bash
# View logs
docker logs llm-rotation-server

# Follow logs
docker logs -f llm-rotation-server

# With docker-compose
docker-compose logs -f
```

### Health Status

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check API key status
curl http://localhost:3000/v1/keys/status
```

## 🔒 Security Considerations

### API Key Management

1. **Never include API keys in the image**
2. **Use environment variables or Docker secrets**
3. **Rotate keys regularly**
4. **Monitor key usage**

### Container Security

1. **Runs as non-root user (nodejs:1001)**
2. **Minimal Alpine Linux base image**
3. **No unnecessary packages**
4. **Health checks enabled**

### Production Deployment

```bash
# Use Docker secrets (Docker Swarm)
echo "your_api_key" | docker secret create openrouter_key -

# Or use external secret management
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
```

## 🌐 Reverse Proxy Setup

### Nginx Configuration

```nginx
upstream llm_rotation {
    server llm-rotation-server:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://llm_rotation;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker Compose with Nginx

```yaml
version: '3.8'

services:
  llm-rotation-server:
    build: .
    environment:
      - PORT=3000
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - llm-rotation-server
    restart: unless-stopped
```

## 🚀 Scaling

### Horizontal Scaling

```yaml
version: '3.8'

services:
  llm-rotation-server:
    build: .
    environment:
      - PORT=3000
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    restart: unless-stopped
    deploy:
      replicas: 3
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - llm-rotation-server
```

### Load Balancing

The server is stateless and can be easily load balanced. Each instance maintains its own key rotation state.

## 🐛 Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker logs llm-rotation-server
   
   # Check if port is available
   netstat -tulpn | grep 3000
   ```

2. **Health check failing**
   ```bash
   # Test health endpoint manually
   docker exec llm-rotation-server node healthcheck.js
   
   # Check if server is running
   docker exec llm-rotation-server ps aux
   ```

3. **API key issues**
   ```bash
   # Check environment variables
   docker exec llm-rotation-server env | grep API_KEY
   
   # Test key status endpoint
   curl http://localhost:3000/v1/keys/status
   ```

### Debug Mode

```bash
# Run with debug output
docker run -it --rm \
  -p 3000:3000 \
  -e OPENROUTER_API_KEY=your_key \
  llm-rotation-server \
  sh

# Inside container
node dist/server.js
```

## 📈 Performance Tuning

### Resource Limits

```yaml
services:
  llm-rotation-server:
    build: .
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Node.js Optimization

```bash
# Set Node.js options
docker run -e NODE_OPTIONS="--max-old-space-size=512" llm-rotation-server
```

## 🔄 Updates and Maintenance

### Rolling Updates

```bash
# Build new image
docker build -t llm-rotation-server:v2 .

# Update with zero downtime
docker-compose up -d --no-deps llm-rotation-server

# Rollback if needed
docker-compose up -d --no-deps llm-rotation-server:v1
```

### Backup and Recovery

```bash
# Export container configuration
docker inspect llm-rotation-server > container-config.json

# Save image
docker save llm-rotation-server > llm-rotation-server.tar

# Load image
docker load < llm-rotation-server.tar
```