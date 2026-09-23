# Docker Guide

## Prerequisites

- Docker Desktop installed and running

## What `docker compose up -d` starts

`docker-compose.yml` runs the two things a developer needs locally:

| Service | Image | Published on | What it is |
| ------- | ----- | ------------ | ---------- |
| `postgres` | `postgres:17-alpine` | `127.0.0.1:5432` | The database, with `storefront_dev` and `storefront_test` created by `init-db.sh` on first start |
| `adminer` | `adminer` | `127.0.0.1:8080` | A web UI for the database |

Both are published to `127.0.0.1` only, so nothing else on the network can reach them. Data lives
in the `postgres17_data` volume and survives `docker compose down`.

The API itself is **not** in the compose file: run it on the host with `npm run watch` while you
work, or build the production image (below).

## Local development

```bash
# 1. Start the database
docker compose up -d

# 2. Create .env from the example and fill it in (keep POSTGRES_HOST=127.0.0.1)
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Run migrations
npm run migrate:up

# 5. Start the dev server
npm run watch
```

The API is then at `http://localhost:3000`, and its docs at `http://localhost:3000/docs`.

## Building the production image

```bash
docker build -t storefront-backend .
docker run --rm -p 3000:3000 --env-file .env storefront-backend
```

The Dockerfile builds in two stages: the first compiles TypeScript and drops the dev
dependencies, the second copies only `dist/`, `node_modules`, the migrations and the spec. It
runs as the unprivileged `node` user, and `node` is the process that receives the stop signal, so
the server shuts down gracefully.

Migrations are a release step, not part of startup — run `npm run migrate:prod` before the new
version starts. `railway.json` wires that up for Railway.

To reach a database running on the host from inside a container, use
`host.docker.internal`; to reach the compose database, attach the container to the compose
network and use `postgres` as the host.

## Common commands

| Command | Description |
| ------- | ----------- |
| `docker compose up -d` | Start the database and Adminer |
| `docker compose stop` | Stop them |
| `docker compose down` | Stop and remove the containers (keeps the data) |
| `docker compose down -v` | Remove everything **including the data** |
| `docker compose ps` | Container status |
| `docker compose logs -f postgres` | Stream database logs |
| `docker compose exec postgres psql -U storefront_user -d storefront_dev` | Open a psql shell |

## Upgrading Postgres

The compose file pins a major version, and a Postgres data directory only works with the version
that wrote it. To move to a newer major version: dump first, point the volume somewhere new, then
restore.

```bash
docker exec storefront-postgres pg_dump -U storefront_user -Fc storefront_dev > backup.dump
# edit docker-compose.yml: new image tag and a new volume name
docker compose up -d
docker exec -i storefront-postgres pg_restore -U storefront_user -d storefront_dev --no-owner < backup.dump
```

The old volume stays untouched until you remove it with `docker volume rm`, so it doubles as the
fallback if the restore goes wrong.

## Troubleshooting

**`[config] The environment is not usable`** — the message lists every variable that is missing or
too short. `TOKEN_SECRET` and `PASSWORD_PEPPER` need at least 32 characters; generate one with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

**Port 5432 already in use** — stop the local PostgreSQL service, or change the published port in
`docker-compose.yml` (`"127.0.0.1:5433:5432"`) and set `POSTGRES_PORT=5433` in `.env`.

**Cannot connect to the Docker daemon** — open Docker Desktop and wait until it is running.

**Database connection refused** — `docker compose ps` shows whether postgres is healthy; give it a
few seconds on first start while it initialises.

**`relation "…" does not exist`** — the migrations have not run against that database:
`npm run migrate:up`.

**`database files are incompatible with server`** — the volume was written by a different major
version of Postgres. See *Upgrading Postgres* above.
