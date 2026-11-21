#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/production-deploy.sh [version]
#
# Safe deployment order:
#   1. Snapshot running application images for automatic rollback
#   2. Pull target release images
#   3. Ensure PostgreSQL and Redis are running and healthy
#   4. Run Prisma database migrations BEFORE starting new app containers
#   5. Start/update application containers and run internal + HTTPS health checks
#   6. Automatically roll back to the previous image snapshot on any failure

set -Eeuo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

VERSION=${1:-latest}
COMPOSE_FILE="docker-compose.prod.yml"
APP_SERVICES=(api admin web astrology)
ROLLBACK_SERVICES=()
ROLLBACK_IN_PROGRESS=false
DEPLOY_MUTATED=false

if [ -z "${ENV_FILE:-}" ]; then
    if [ -f ".env.production" ]; then
        ENV_FILE=".env.production"
    elif [ -f ".env" ]; then
        ENV_FILE=".env"
    else
        ENV_FILE=".env.production"
    fi
fi
export ENV_FILE

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
else
    COMPOSE_CMD=(docker-compose)
fi

compose() {
    "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" "$@"
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Production Deployment - ${VERSION}${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ ${ENV_FILE} file not found${NC}"
    echo "Please create ${ENV_FILE} outside Git tracking with production configuration"
    exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

export IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
export IMAGE_REPO="${IMAGE_REPO:-meoacar/womens_wellness}"
export IMAGE_TAG="${IMAGE_TAG:-${VERSION#v}}"
IMAGE_PREFIX="${IMAGE_REGISTRY}/${IMAGE_REPO}"

wait_for_healthy() {
    local container_name="$1"
    local timeout="${2:-60}"
    local elapsed=0
    local status

    while [ "$elapsed" -lt "$timeout" ]; do
        status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || echo "missing")
        if [ "$status" = "healthy" ]; then
            return 0
        fi
        if [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
            echo -e "${RED}✗ Container ${container_name} stopped unexpectedly (status: ${status})${NC}"
            return 1
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    echo -e "${RED}✗ Timed out waiting for ${container_name} to become healthy (last status: ${status:-unknown})${NC}"
    return 1
}

snapshot_previous_images() {
    local svc container img_id
    for svc in "${APP_SERVICES[@]}"; do
        container="wellness-${svc}"
        if docker container inspect "$container" >/dev/null 2>&1; then
            img_id=$(docker inspect --format '{{.Image}}' "$container" 2>/dev/null || true)
            if [ -n "$img_id" ] && docker image inspect "$img_id" >/dev/null 2>&1; then
                docker tag "$img_id" "${IMAGE_PREFIX}-${svc}:rollback"
                ROLLBACK_SERVICES+=("$svc")
            fi
        fi
    done

    if [ "${#ROLLBACK_SERVICES[@]}" -gt 0 ]; then
        echo -e "${BLUE}ℹ Saved rollback snapshot for: ${ROLLBACK_SERVICES[*]}${NC}"
    else
        echo -e "${YELLOW}⚠ No running application containers found for rollback snapshot (initial deployment)${NC}"
    fi
}

service_has_rollback() {
    local target="$1"
    local svc
    for svc in "${ROLLBACK_SERVICES[@]}"; do
        if [ "$svc" = "$target" ]; then
            return 0
        fi
    done
    return 1
}

run_health_checks() {
    local svc
    for svc in api admin web astrology nginx; do
        wait_for_healthy "wellness-${svc}" 60
    done

    if compose exec -T api curl -fsS http://localhost:4000/healthz >/dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy (:4000/healthz)${NC}"
    else
        echo -e "${RED}✗ API health check failed${NC}"
        compose logs --tail=50 api || true
        return 1
    fi

    if compose exec -T admin curl -fsS http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Admin is healthy (:3000)${NC}"
    else
        echo -e "${RED}✗ Admin health check failed${NC}"
        compose logs --tail=50 admin || true
        return 1
    fi

    if compose exec -T web curl -fsS http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Web is healthy (:3000)${NC}"
    else
        echo -e "${RED}✗ Web health check failed${NC}"
        compose logs --tail=50 web || true
        return 1
    fi

    if compose exec -T astrology curl -fsS http://localhost:5000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Astrology service is healthy (:5000/health)${NC}"
    else
        echo -e "${RED}✗ Astrology health check failed${NC}"
        compose logs --tail=50 astrology || true
        return 1
    fi

    if compose exec -T nginx nginx -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Nginx TLS configuration is valid${NC}"
    else
        echo -e "${RED}✗ Nginx configuration check failed${NC}"
        compose logs --tail=50 nginx || true
        return 1
    fi

    if [ -n "${PRODUCTION_API_URL:-}" ]; then
        if curl -fsS --max-time 15 "${PRODUCTION_API_URL%/}/healthz" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Public API HTTPS endpoint is healthy (${PRODUCTION_API_URL%/}/healthz)${NC}"
        else
            echo -e "${RED}✗ Public API HTTPS health check failed (${PRODUCTION_API_URL%/}/healthz)${NC}"
            return 1
        fi
    fi

    if [ -n "${PRODUCTION_URL:-}" ]; then
        if curl -fsS --max-time 15 "${PRODUCTION_URL%/}" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Public Web HTTPS endpoint is healthy (${PRODUCTION_URL%/})${NC}"
        else
            echo -e "${RED}✗ Public Web HTTPS health check failed (${PRODUCTION_URL%/})${NC}"
            return 1
        fi
    fi

    return 0
}

rollback_deployment() {
    local exit_code="$1"
    local failed_line="$2"

    if [ "$ROLLBACK_IN_PROGRESS" = true ]; then
        return
    fi
    ROLLBACK_IN_PROGRESS=true
    trap - ERR
    set +e

    echo ""
    echo -e "${RED}✗ Deployment failed at line ${failed_line} (exit code: ${exit_code}). Collecting recent API logs...${NC}"
    compose logs --tail=50 api || true

    if [ "$DEPLOY_MUTATED" != true ]; then
        exit "$exit_code"
    fi

    if [ "${#ROLLBACK_SERVICES[@]}" -eq 0 ]; then
        echo -e "${YELLOW}⚠ No previous version snapshot exists. Stopping failed application containers...${NC}"
        compose stop "${APP_SERVICES[@]}" || true
        exit "$exit_code"
    fi

    echo -e "${YELLOW}↺ Rolling back services to previous snapshot (${ROLLBACK_SERVICES[*]})...${NC}"
    local svc
    for svc in "${APP_SERVICES[@]}"; do
        if ! service_has_rollback "$svc"; then
            compose stop "$svc" >/dev/null 2>&1 || true
        fi
    done

    if IMAGE_TAG="rollback" compose up -d --no-deps --remove-orphans "${ROLLBACK_SERVICES[@]}"; then
        for svc in "${ROLLBACK_SERVICES[@]}"; do
            wait_for_healthy "wellness-${svc}" 60 || true
        done
        echo -e "${YELLOW}✓ Rollback containers restored. Note: verify database migration compatibility if schema changed.${NC}"
    else
        echo -e "${RED}✗ Automatic rollback failed! Manual intervention required.${NC}"
    fi

    exit "$exit_code"
}

trap 'rollback_deployment $? $LINENO' ERR

echo -e "${BLUE}1. Capturing previous release snapshot for rollback...${NC}"
snapshot_previous_images

echo -e "${BLUE}2. Pulling published images (tag: ${IMAGE_TAG})...${NC}"
compose pull

echo -e "${BLUE}3. Ensuring PostgreSQL and Redis are healthy...${NC}"
compose up -d postgres redis
wait_for_healthy wellness-db 60
wait_for_healthy wellness-redis 60

DEPLOY_MUTATED=true

echo -e "${BLUE}4. Running database migrations BEFORE updating application containers...${NC}"
compose run --rm --no-deps api pnpm prisma migrate deploy

echo -e "${BLUE}5. Starting updated application and proxy containers...${NC}"
compose up -d --remove-orphans
compose exec -T nginx nginx -t
compose exec -T nginx nginx -s reload || compose restart nginx

echo -e "${BLUE}6. Running internal container & HTTPS health checks...${NC}"
run_health_checks

trap - ERR

echo -e "${BLUE}7. Recording release state and cleaning up unused images...${NC}"
printf '%s\n' "${IMAGE_TAG}" > .deploy-current-tag
docker image prune -af --filter "until=24h"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Successful! 🚀            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Deployed version:${NC} ${IMAGE_TAG}"
compose ps
