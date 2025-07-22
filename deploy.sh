#!/bin/bash

# PhotoVision Deployment Script
# Usage: ./deploy.sh [production|staging]

set -e

# Configuration
ENVIRONMENT=${1:-production}
APP_DIR="/var/www/photovision"
BACKUP_DIR="/var/backups/photovision"
PM2_APP_NAME="photovision"

echo "🚀 Starting PhotoVision deployment to $ENVIRONMENT"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup current data if app directory exists
if [ -d "$APP_DIR/data" ]; then
    echo "📦 Backing up current data..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    tar -czf "$BACKUP_DIR/data_backup_$TIMESTAMP.tar.gz" -C "$APP_DIR" data/
    echo "✅ Data backed up to $BACKUP_DIR/data_backup_$TIMESTAMP.tar.gz"
fi

# Update application code
echo "📥 Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Ensure data directory exists with correct permissions
echo "📁 Setting up data directory..."
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/data/albums"
mkdir -p "$APP_DIR/data/backups"
mkdir -p "$APP_DIR/logs"

# Set correct permissions (adjust user/group as needed)
chown -R www-data:www-data "$APP_DIR/data"
chown -R www-data:www-data "$APP_DIR/logs"
chmod -R 755 "$APP_DIR/data"
chmod -R 755 "$APP_DIR/logs"

# Copy environment file if it doesn't exist
if [ ! -f "$APP_DIR/.env" ]; then
    echo "⚙️  Setting up environment file..."
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo "⚠️  Please edit $APP_DIR/.env with your API keys"
fi

# Reload PM2 application
echo "🔄 Restarting application..."
if pm2 show "$PM2_APP_NAME" > /dev/null 2>&1; then
    pm2 reload "$PM2_APP_NAME"
else
    pm2 start ecosystem.config.js
    pm2 save
fi

# Verify deployment
echo "✅ Verifying deployment..."
sleep 5
if pm2 show "$PM2_APP_NAME" | grep -q "online"; then
    echo "✅ PhotoVision deployed successfully!"
    echo "📊 Check application logs: pm2 logs $PM2_APP_NAME"
else
    echo "❌ Deployment verification failed!"
    echo "🔍 Check logs: pm2 logs $PM2_APP_NAME"
    exit 1
fi

echo "🎉 Deployment complete!"