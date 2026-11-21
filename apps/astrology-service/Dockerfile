# Builder stage (expects monorepo root build context `.`)
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY apps/astrology-service/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Production stage
FROM python:3.11-slim AS production

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
COPY apps/astrology-service/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

COPY apps/astrology-service/ .

RUN mkdir -p cache && \
    useradd -m -u 1001 astrology && \
    chown -R astrology:astrology /app

USER astrology

EXPOSE 5000

CMD ["python", "app.py"]
