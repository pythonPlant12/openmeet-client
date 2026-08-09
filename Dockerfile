# Stage 1: node-base - Pin Node.js and pnpm
# Stage 2: deps      - Install dependencies
# Stage 3: builder   - Build the app
# Stage 4: prod      - Minimal nginx image serving static files

# --- Stage 1: Node.js and pnpm ---
FROM node:26.7.0-alpine AS node-base
RUN npm install --global pnpm@11.20.0

# --- Stage 2: Dependencies ---
FROM node-base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Stage 3: Builder ---
FROM node-base AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build
RUN pnpm build

# --- Stage 4: Production ---
FROM nginx:alpine AS prod

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
    CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
