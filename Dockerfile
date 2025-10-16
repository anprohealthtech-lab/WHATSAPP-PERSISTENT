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

# Clean install to avoid npm optional dependencies bug
RUN rm -rf package-lock.json node_modules 2>/dev/null || true

# Install ALL dependencies (use npm install instead of npm ci to avoid optional deps bug)
RUN npm install

# Copy application code
COPY NodeBackend/ ./
COPY shared/ ./shared/

# Create necessary directories for persistent data
RUN mkdir -p server/sessions uploads

# Build the application (needs devDependencies like vite, esbuild)
RUN npm run build

# Now remove devDependencies to keep production image lean  
RUN rm -rf node_modules && npm ci --only=production && npm cache clean --force

# Set permissions
RUN chown -R node:node /app

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