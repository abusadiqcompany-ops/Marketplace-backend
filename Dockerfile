FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Build
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/build-output  ./build-output

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); const port=process.env.PORT || 3001; const req=http.get({host:'127.0.0.1', port, path:'/health'}, (res)=>{ if (res.statusCode !== 200) process.exit(1); }); req.on('error', ()=>process.exit(1));"

EXPOSE 3001

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["node", "build-output/index.js"]
