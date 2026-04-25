# Claims Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install security updates
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY backend/routes/claims.js ./routes/
COPY backend/models/Claim.js ./models/
COPY backend/middleware/ ./middleware/
COPY backend/services/ ./services/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3003

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "-r", "dd-trace/init", "services/claims-service.js"]
