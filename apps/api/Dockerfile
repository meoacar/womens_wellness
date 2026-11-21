# Base stage - shared dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache openssl curl
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
EXPOSE 4000
CMD ["pnpm", "dev"]

# Build stage
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN find . -name "*.spec.ts" -type f -delete
RUN pnpm build

# Production stage
FROM base AS production
WORKDIR /app

# Copy production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile

# Copy built application, static public assets, generated Prisma Client, and Prisma CLI for migrations
# Copy built application, static public assets, and Prisma schema/migrations
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/public ./apps/api/public
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/apps/api/node_modules/.bin ./apps/api/node_modules/.bin

WORKDIR /app/apps/api

# Generate Prisma Client in production stage and verify production Prisma CLI is runnable
RUN pnpm exec prisma generate

# Create non-root user and persistent uploads directory
RUN mkdir -p /app/apps/api/uploads/profiles && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app/apps/api/uploads

USER nestjs

EXPOSE 4000

ENV PORT=4000

CMD ["node", "dist/src/main.js"]
