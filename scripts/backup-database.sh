#!/bin/bash

# Database Backup Script
# Usage: ./scripts/backup-database.sh

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="wellness_db_${TIMESTAMP}.sql"
COMPOSE_FILE=${1:-docker-compose.prod.yml}

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
else
    COMPOSE_CMD=(docker-compose)
fi

echo -e "${BLUE}Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Load environment variables safely (handles quoted values with spaces)
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

# Backup database
echo -e "${BLUE}Creating backup: ${BACKUP_FILE}${NC}"
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec -T postgres pg_dump \
    -U "${POSTGRES_USER:-wellness}" \
    -d "${POSTGRES_DB:-wellness}" \
    --clean --if-exists \
    > "${BACKUP_DIR}/${BACKUP_FILE}"

if [ -s "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    # Compress backup
    echo -e "${BLUE}Compressing backup...${NC}"
    gzip -f "${BACKUP_DIR}/${BACKUP_FILE}"
    gzip -t "${BACKUP_DIR}/${BACKUP_FILE}.gz"

    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}.gz" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    echo -e "${GREEN}  File: ${BACKUP_DIR}/${BACKUP_FILE}.gz${NC}"
    echo -e "${GREEN}  Size: ${BACKUP_SIZE}${NC}"

    # Keep only last 7 backups
    echo -e "${BLUE}Cleaning old backups...${NC}"
    (cd "$BACKUP_DIR" && ls -t wellness_db_*.sql.gz | tail -n +8 | xargs -r rm --)

    echo -e "${GREEN}✓ Backup complete${NC}"
else
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
    echo -e "${YELLOW}✗ Backup failed or produced empty file${NC}"
    exit 1
fi
