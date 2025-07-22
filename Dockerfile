# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install dependencies for Sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port (default 3001, can be overridden)
EXPOSE 3001

# Run the application
CMD ["node", "server.js"]