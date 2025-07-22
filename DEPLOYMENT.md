# PhotoVision Deployment Guide

This guide covers various deployment options for the PhotoVision application.

## Prerequisites

- Node.js >= 16.0.0
- API Keys:
  - Anthropic Claude API key
  - SmugMug API key and secret
- Domain name (for production deployments)
- SSL certificate (for HTTPS)

## Deployment Options

### 1. VPS Deployment (Recommended for Production)

Best for: Full control, persistent file storage, custom configurations

#### Setup Steps:

1. **Prepare the server:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js (using NodeSource)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2 globally
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install -y nginx
   
   # Install Git
   sudo apt install -y git
   ```

2. **Clone and setup application:**
   ```bash
   # Create app directory
   sudo mkdir -p /var/www/photovision
   sudo chown $USER:$USER /var/www/photovision
   
   # Clone repository
   cd /var/www/photovision
   git clone https://github.com/yourusername/photovision.git .
   
   # Install dependencies
   npm ci --only=production
   
   # Setup environment
   cp .env.example .env
   # Edit .env with your API keys
   nano .env
   ```

3. **Configure Nginx:**
   ```bash
   # Copy nginx configuration
   sudo cp nginx.conf /etc/nginx/sites-available/photovision
   sudo ln -s /etc/nginx/sites-available/photovision /etc/nginx/sites-enabled/
   
   # Edit configuration with your domain
   sudo nano /etc/nginx/sites-available/photovision
   
   # Test and reload Nginx
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Start application with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. **Setup SSL with Let's Encrypt:**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### 2. Docker Deployment

Best for: Containerized environments, easy scaling, consistent deployments

#### Local Development:
```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Production Docker:
```bash
# Build image
docker build -t photovision:latest .

# Run container with volume mount
docker run -d \
  --name photovision \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -e ANTHROPIC_API_KEY=your_key \
  -e SMUGMUG_API_KEY=your_key \
  -e SMUGMUG_API_SECRET=your_secret \
  --restart unless-stopped \
  photovision:latest
```

### 3. Render.com Deployment

Best for: Managed hosting with persistent storage

1. Fork/push repository to GitHub
2. Connect GitHub repo to Render
3. Use `render.yaml` configuration
4. Add environment variables in Render dashboard
5. Deploy

### 4. Fly.io Deployment

Best for: Global edge deployment with persistent volumes

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Create app
fly launch

# Create volume for persistent storage
fly volumes create photovision_data --size 1

# Set secrets
fly secrets set ANTHROPIC_API_KEY=your_key
fly secrets set SMUGMUG_API_KEY=your_key
fly secrets set SMUGMUG_API_SECRET=your_secret

# Deploy
fly deploy
```

### 5. Railway Deployment

Best for: Simple deployments with GitHub integration

1. Connect GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy with one click
4. Configure persistent volume in Railway settings

## Post-Deployment Steps

1. **Verify deployment:**
   - Visit your domain
   - Check API endpoints: `/api/health`
   - Test SmugMug connection

2. **Configure SmugMug OAuth:**
   - Update callback URL in SmugMug app settings
   - Format: `https://your-domain.com/api/smugmug/auth/callback`

3. **Monitor application:**
   - Check logs regularly
   - Monitor disk usage for data directory
   - Set up uptime monitoring

4. **Backup strategy:**
   - Regular backups of `/data` directory
   - Automated backup script (cron job)
   - Store backups off-site

## Environment Variables

Required environment variables for all deployments:

```env
# API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key
SMUGMUG_API_KEY=your_smugmug_api_key
SMUGMUG_API_SECRET=your_smugmug_api_secret

# Server Configuration
PORT=3001
NODE_ENV=production
```

## Troubleshooting

### Common Issues:

1. **Sharp installation fails:**
   - Ensure build tools are installed
   - Use Alpine Linux specific instructions for Docker

2. **Permission errors with data directory:**
   ```bash
   sudo chown -R www-data:www-data /path/to/data
   sudo chmod -R 755 /path/to/data
   ```

3. **SmugMug OAuth callback fails:**
   - Verify callback URL matches exactly
   - Check for HTTPS requirement
   - Ensure cookies are enabled

4. **Memory issues during batch processing:**
   - Increase Node.js memory limit: `node --max-old-space-size=4096 server.js`
   - Reduce concurrent batch jobs in settings

## Security Considerations

1. **API Keys:**
   - Never commit `.env` file
   - Use environment variables or secrets management
   - Rotate keys regularly

2. **File Permissions:**
   - Restrict data directory access
   - Run application as non-root user
   - Use proper file ownership

3. **Network Security:**
   - Always use HTTPS in production
   - Configure firewall rules
   - Implement rate limiting for public endpoints

4. **Data Protection:**
   - Regular backups
   - Encrypt sensitive data at rest
   - Monitor for unauthorized access

## Maintenance

1. **Updates:**
   ```bash
   cd /var/www/photovision
   git pull origin main
   npm ci --only=production
   pm2 reload photovision
   ```

2. **Log Management:**
   - Rotate logs regularly
   - Archive old logs
   - Monitor disk space

3. **Performance Monitoring:**
   - Check response times
   - Monitor API usage
   - Track batch processing performance

## Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test API connections
4. Review error messages

Remember to adapt these instructions based on your specific hosting environment and requirements.