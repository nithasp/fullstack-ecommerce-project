# Docker Guide

## Prerequisites

- Docker Desktop installed and running

## Quick Start

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Create .env from example
cp .env.example .env

# 3. Update .env with Docker credentials
#    POSTGRES_USER=storefront_user
#    POSTGRES_PASSWORD=storefront_pass

# 4. Install dependencies
npm install

# 5. Run migrations
npm run migrate:up

# 6. Start dev server
npm run watch
```

Server runs at `http://localhost:3000`

## What `docker-compose up -d` Does

- Pulls `postgres:14-alpine` image (first time only)
- Creates container `storefront-postgres` on port `5432`
- Creates `storefront_dev` (main) and `storefront_test` databases via `init-db.sh`
- Data persists in a Docker volume

## Common Commands

| Command | Description |
| --- | --- |
| `docker-compose up -d` | Start database |
| `docker-compose stop` | Stop database |
| `docker-compose down` | Stop and remove container (keeps data) |
| `docker-compose down -v` | Stop and remove everything **including data** |
| `docker-compose ps` | Check container status |
| `docker-compose logs postgres` | View database logs |
| `docker-compose exec postgres psql -U storefront_user -d storefront_dev` | Open psql shell |

## Troubleshooting

**Port 5432 already in use** -- Stop local PostgreSQL or change the port in `docker-compose.yml` (`"5433:5432"`) and update `POSTGRES_PORT` in `.env`.

**Cannot connect to Docker daemon** -- Open Docker Desktop and wait until it's fully running.

**Database connection refused** -- Run `docker-compose ps` to check if the container is healthy, then `docker-compose restart` if needed.
