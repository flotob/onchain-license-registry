# Railway-optimized Dockerfile
# Environment variables are injected by Railway at build and runtime

FROM node:20-alpine AS development-dependencies-env
COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
WORKDIR /app

# Copy node_modules from dev dependencies
COPY --from=development-dependencies-env /app/node_modules /app/node_modules

# Build arguments for VITE_ environment variables (passed from Railway)
# These are baked into the client bundle at build time
ARG VITE_CG_DATA_REFRESH_INTERVAL
ARG VITE_PLUGIN_PUBLIC_KEY
ARG VITE_URL_PREFIX
ARG VITE_BASE_URL
ARG VITE_LICENSE_ENS_NAME
ARG VITE_REGISTRY_CID

# Make build args available as env vars during build
ENV VITE_CG_DATA_REFRESH_INTERVAL=$VITE_CG_DATA_REFRESH_INTERVAL
ENV VITE_PLUGIN_PUBLIC_KEY=$VITE_PLUGIN_PUBLIC_KEY
ENV VITE_URL_PREFIX=$VITE_URL_PREFIX
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_LICENSE_ENS_NAME=$VITE_LICENSE_ENS_NAME
ENV VITE_REGISTRY_CID=$VITE_REGISTRY_CID

# Generate Prisma client and build the app
RUN npm run prisma:generate
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package.json package-lock.json /app/

# Copy production dependencies
COPY --from=production-dependencies-env /app/node_modules /app/node_modules

# Copy build output
COPY --from=build-env /app/build /app/build

# Copy Prisma files for migrations
COPY --from=build-env /app/prisma /app/prisma
COPY --from=build-env /app/generated /app/generated

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Railway sets PORT automatically
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
