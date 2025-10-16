FROM node:18-slim

# Install Chrome dependencies for WhatsApp Web
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY NodeBackend/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY NodeBackend/ ./
COPY shared/ ./shared/

# Create necessary directories for persistent data
RUN mkdir -p server/sessions uploads

# Set permissions
RUN chown -R node:node /app

# Build the application
RUN npm run build

# Switch to non-root user
USER node

# Set Chrome path for WhatsApp Web
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

EXPOSE 3001

CMD ["npm", "start"]