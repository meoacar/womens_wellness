# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache curl
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
WORKDIR /app/apps/admin
EXPOSE 3001
CMD ["pnpm", "dev"]

# Build stage (NEXT_PUBLIC_* must be supplied at build time for browser bundles)
FROM base AS builder
ARG NEXT_PUBLIC_API_BASE_URL=https://api.kadinatlasi.com
ARG NEXT_PUBLIC_WEB_URL=https://kadinatlasi.com
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
WORKDIR /app/apps/admin
RUN pnpm build

# Production stage
FROM base AS production
ARG NEXT_PUBLIC_API_BASE_URL=https://api.kadinatlasi.com
ARG NEXT_PUBLIC_WEB_URL=https://kadinatlasi.com
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=builder /app/apps/admin/next.config.js ./apps/admin/

WORKDIR /app/apps/admin

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app/apps/admin/.next

USER nextjs

ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]
