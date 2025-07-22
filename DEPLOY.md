# PhotoVision Docker Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- SmugMug API credentials
- Anthropic API key
- Domain name (for production deployment with HTTPS)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd image-search
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Build and run with Docker Compose**
   ```bash
   # Development mode
   docker-compose up --build

   # Production mode (detached)
   docker-compose up -d --build
   ```

4. **Access the application**
   - Open http://localhost:3001 (or your configured PORT)

## Deployment Options

### Option 1: Basic Docker Deployment

```bash
# Build the image
docker build -t photovision .

# Run the container
docker run -d \
  --name photovision \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --restart unless-stopped \
  photovision
```

### Option 2: Docker Compose (Recommended)

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f photovision

# Stop the application
docker-compose down

# Restart after changes
docker-compose restart photovision
```

### Option 3: Production with Nginx

1. **Create nginx.conf**
   ```nginx
   events {
       worker_connections 1024;
   }

   http {
       upstream photovision {
           server photovision:3001;
       }

       server {
           listen 80;
           server_name your-domain.com;

           location / {
               proxy_pass http://photovision;
               proxy_http_version 1.1;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header Connection 'upgrade';
               proxy_set_header Host $host;
               proxy_cache_bypass $http_upgrade;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
           }
       }
   }
   ```

2. **Run with production profile**
   ```bash
   docker-compose --profile production up -d
   ```

## Data Persistence

The `/data` directory contains all your application data:
- `images.json` - Analyzed image metadata
- `config.json` - SmugMug OAuth tokens and settings
- `searchIndex.json` - Search index data
- `albums/` - Album data cache

**Important**: Always back up the `/data` directory before updates!

## Backup Strategy

```bash
# Backup data
tar -czf photovision-backup-$(date +%Y%m%d).tar.gz data/

# Restore data
tar -xzf photovision-backup-20240101.tar.gz
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude AI API key | Yes |
| `SMUGMUG_API_KEY` | SmugMug API key | Yes |
| `SMUGMUG_API_SECRET` | SmugMug API secret | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (production/development) | No |

## Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

## Monitoring

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f photovision

# Check health
curl http://localhost:3001/api/health

# Monitor resource usage
docker stats photovision
```

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs photovision`
- Verify environment variables in `.env`
- Ensure data directory has proper permissions

### SmugMug OAuth issues
- Update callback URL in SmugMug app settings to match your domain
- For local development: `http://localhost:3001/api/smugmug/auth/callback`
- For production: `https://your-domain.com/api/smugmug/auth/callback`

### Memory issues during image processing
- Increase Docker memory limit in Docker Desktop settings
- Reduce concurrent batch processing jobs in settings

### Data not persisting
- Ensure volume mount is correct in docker-compose.yml
- Check file permissions: `ls -la data/`

## Security Considerations

1. **HTTPS Setup** (for production)
   - Use Let's Encrypt with nginx-proxy or Traefik
   - Or deploy behind a reverse proxy with SSL termination

2. **Environment Variables**
   - Never commit `.env` file
   - Use Docker secrets for production deployments

3. **Network Security**
   - Consider using Docker networks to isolate services
   - Implement rate limiting in nginx configuration

## Performance Optimization

1. **Image Processing**
   - Adjust batch processing limits based on server resources
   - Monitor memory usage during batch operations

2. **Docker Optimization**
   - Use multi-stage builds to reduce image size
   - Enable BuildKit: `DOCKER_BUILDKIT=1 docker build .`

3. **Volume Performance**
   - Use named volumes for better performance
   - Consider SSD storage for data directory

## Deployment Platforms

### DigitalOcean
```bash
# Deploy to DigitalOcean App Platform
doctl apps create --spec .do/app.yaml
```

### AWS ECS
- Use the Dockerfile with ECS task definitions
- Mount EFS for persistent data storage

### Google Cloud Run
- Requires external storage solution (Cloud Storage)
- Not ideal due to file-based storage

### Self-hosted VPS
- Follow the nginx production setup above
- Use systemd for process management
- Set up automated backups with cron