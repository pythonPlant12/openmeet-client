# Stage 1: deps    - Install dependencies
# Stage 2: builder - Build the app
# Stage 3: prod    - Minimal nginx image serving static files

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install

# --- Stage 2: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args passed at build time
ARG VITE_SFU_WSS_URL
ENV VITE_SFU_WSS_URL=${VITE_SFU_WSS_URL}

# Build
RUN yarn build

# --- Stage 3: Production ---
FROM nginx:alpine AS prod

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
    CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
