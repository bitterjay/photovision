// PM2 Configuration for PhotoVision
module.exports = {
  apps: [{
    name: 'photovision',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    // Logging
    error_file: './logs/photovision-error.log',
    out_file: './logs/photovision-out.log',
    log_file: './logs/photovision-combined.log',
    time: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Monitoring
    min_uptime: '10s',
    max_restarts: 10,
    
    // Ignore watch for these paths
    ignore_watch: [
      'node_modules',
      'data',
      'logs',
      '.git',
      '*.log'
    ]
  }]
};