# Notification Service Dockerfile
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
COPY backend/routes/notifications.js ./routes/
COPY backend/services/notificationService.js ./services/
COPY backend/services/queueService.js ./services/
COPY backend/middleware/ ./middleware/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3004

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "-r", "dd-trace/init", "services/notification-service.js"]
