# Infrastructure Description

This document describes the AWS cloud infrastructure used to host the MyStore full-stack application.

---

## Overview

The application is split into three independently hosted components, each served by a dedicated AWS managed service:

| Component | Service | Purpose |
|---|---|---|
| Database | AWS RDS (PostgreSQL) | Persistent data store for users, products, orders, carts |
| Backend API | AWS Elastic Beanstalk | Node/Express REST API |
| Frontend SPA | AWS S3 (static hosting) | Angular 18 single-page application |

---

## 1. AWS RDS — PostgreSQL Database

- **Engine:** PostgreSQL 14
- **Instance class:** `db.t3.micro` (free tier eligible)
- **Database name:** `storefront`
- **Port:** `5432`
- **Multi-AZ:** Disabled (single-AZ for cost savings; enable for production HA)
- **Public accessibility:** No — the RDS instance is only reachable from within the same VPC as Elastic Beanstalk
- **Credentials:** Stored as environment variables in Elastic Beanstalk; never committed to source control

**Key environment variables consumed by the backend:**

| Variable | Description |
|---|---|
| `POSTGRES_HOST` | RDS endpoint hostname |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | Production database name |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | DB password (secret) |

---

## 2. AWS Elastic Beanstalk — Backend API

- **Platform:** Node.js 18 (64-bit Amazon Linux 2023)
- **Application name:** `storefront-api`
- **Environment name:** `storefront-api-env`
- **Instance type:** `t3.micro` (free tier eligible)
- **Load balancer:** Application Load Balancer (auto-provisioned by EB)
- **Health check path:** `/` (returns HTTP 200)
- **Port:** `8080` (EB default; mapped from the app's `process.env.PORT`)

**Environment variables set in the EB console / CircleCI secrets:**

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `ENV` | `production` |
| `PORT` | `8080` |
| `POSTGRES_HOST` | RDS endpoint |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | Production DB name |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | DB password |
| `TOKEN_SECRET` | JWT signing secret |
| `BCRYPT_PASSWORD` | Bcrypt pepper |
| `SALT_ROUNDS` | Bcrypt rounds |
| `ACCESS_TOKEN_EXPIRY` | JWT access token TTL (e.g. `15m`) |
| `REFRESH_TOKEN_EXPIRY_DAYS` | Refresh token TTL in days |
| `ALLOWED_ORIGIN` | S3 website URL (CORS) |

---

## 3. AWS S3 — Frontend Static Hosting

- **Bucket name:** `storefront-frontend-<your-unique-suffix>`
- **Region:** `us-east-1`
- **Static website hosting:** Enabled
  - Index document: `index.html`
  - Error document: `index.html` (required for Angular client-side routing)
- **Public access:** Block Public Access settings turned **off** for the bucket; bucket policy grants `s3:GetObject` to `*`
- **CORS:** Not required (Angular app is served from S3; API calls go to the EB URL)

**Deployment:** The Angular production bundle (`app/frontend/dist/.../browser/`) is synced to the bucket root via `aws s3 sync` in the CircleCI pipeline.

---

## Networking Notes

- RDS is in the **default VPC**, accessible only from the EB security group.
- Elastic Beanstalk sits in the **same VPC**; its security group allows outbound TCP to RDS on port 5432.
- S3 static website endpoint is publicly accessible over HTTP. (Optionally front with CloudFront for HTTPS + CDN.)
