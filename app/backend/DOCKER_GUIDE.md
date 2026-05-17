# Docker Guide

## Prerequisites

- Docker Desktop installed and running

## Quick Start (Full Stack with Docker)

```bash
# 1. Create .env from example
cp .env.example .env

# 2. Edit .env — at minimum set a real TOKEN_SECRET, BCRYPT_PASSWORD
#    POSTGRES_HOST is overridden to "postgres" automatically inside the container

# 3. Build and start all services (PostgreSQL + backend)
docker-compose up --build -d

# 4. Check logs
docker-compose logs -f backend
```

Server runs at `http://localhost:3000`

## Local Development (Backend on Host, PostgreSQL in Docker)

```bash
# 1. Start PostgreSQL only
docker-compose up postgres -d

# 2. Create .env from example (keep POSTGRES_HOST=localhost)
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Run migrations
npm run migrate:up

# 5. Start dev server with auto-reload
npm run watch
```

## What `docker-compose up` Does

- Pulls `postgres:14-alpine` image (first time only)
- Creates container `storefront-postgres` on port `5432`
- Creates `storefront_dev` (main) and `storefront_test` databases via `init-db.sh`
- Builds the backend image and starts `storefront-backend` on port `3000`
- Backend waits for PostgreSQL to be healthy before starting
- Data persists in a Docker volume

## Common Commands

| Command | Description |
| --- | --- |
| `docker-compose up --build -d` | Build and start all services |
| `docker-compose up postgres -d` | Start database only |
| `docker-compose stop` | Stop all services |
| `docker-compose down` | Stop and remove containers (keeps data) |
| `docker-compose down -v` | Stop and remove everything **including data** |
| `docker-compose ps` | Check container status |
| `docker-compose logs -f backend` | Stream backend logs |
| `docker-compose logs postgres` | View database logs |
| `docker-compose exec postgres psql -U storefront_user -d storefront_dev` | Open psql shell |

## Troubleshooting

**`TOKEN_SECRET must be set as an environment variable in production`** — The `.env` file is missing or `TOKEN_SECRET` is empty. Run `cp .env.example .env` and set a value for `TOKEN_SECRET`.

**Port 5432 already in use** — Stop local PostgreSQL or change the port in `docker-compose.yml` (`"5433:5432"`) and update `POSTGRES_PORT` in `.env`.

**Cannot connect to Docker daemon** — Open Docker Desktop and wait until it's fully running.

**Database connection refused** — Run `docker-compose ps` to check if postgres is healthy, then `docker-compose restart` if needed.

**Backend crashes on startup** — Run `docker-compose logs backend` to see the error. Ensure all required variables in `.env` are set.
