# CI/CD Pipeline Process

This document explains the continuous integration and deployment (CI/CD) pipeline configured in CircleCI.

---

## Overview

The pipeline is defined in `.circleci/config.yml` and runs automatically on every push to any branch. Deployment to AWS only happens when code is merged (or pushed) to the **`main`** branch.

---

## Trigger

- **Tool:** CircleCI (connected to GitHub via OAuth)
- **Trigger:** Every `git push` to any branch on the linked GitHub repository
- **Deploy condition:** Deploy jobs run only on the `main` branch

---

## Pipeline Stages

```
Push to GitHub
      │
      ├──────────────────────────────────────────┐
      ▼                                          ▼
[build-and-test-backend]            [build-and-test-frontend]
  1. npm install (app/backend)        1. npm install (app/frontend)
  2. tsc (TypeScript compile)         2. Set EB_API_URL in env.production.ts
  3. db-migrate up (test DB)          3. ng build --configuration production
  4. jasmine (7 test suites)          4. ng test --browsers=ChromeHeadless
  5. db-migrate reset                 5. Persist dist/ workspace
      │                                          │
      │  (main branch only)                      │  (main branch only)
      ▼                                          ▼
[deploy-backend]                    [deploy-frontend]
  1. Install EB CLI                   1. Attach dist/ workspace
  2. aws-cli/setup                    2. aws-cli/setup
  3. npm run build                    3. aws s3 sync dist/ → S3 bucket
  4. Set EB env vars (secrets)
  5. eb deploy
```

---

## Job Details

### `build-and-test-backend`

| Step | Description |
|---|---|
| Checkout | Clone the repo |
| Install | `npm install` in `app/backend/` |
| Build | `npx tsc` — compile TypeScript to `dist/` |
| Migrate | `db-migrate --env test up` — create test schema |
| Test | `jasmine` — run 7 spec files (models + handlers) |
| Reset | `db-migrate --env test reset` — tear down test schema |

A Postgres 14 sidecar container is spun up for the duration of this job.

### `build-and-test-frontend`

| Step | Description |
|---|---|
| Checkout | Clone the repo |
| Install | `npm install` in `app/frontend/` |
| Set API URL | Replace `YOUR_EB_ENV_URL` placeholder using `$EB_API_URL` secret |
| Build | `ng build --configuration production` |
| Test | `ng test --watch=false --browsers=ChromeHeadless` |
| Persist | `dist/` folder persisted to workspace for the deploy job |

A browser-capable Docker image is used so that Karma can launch headless Chrome.

### `deploy-backend` _(main branch only)_

| Step | Description |
|---|---|
| Checkout | Clone the repo |
| AWS setup | Configure credentials from CircleCI env vars |
| Install EB CLI | `pip install awsebcli` |
| Build | `npm run build` |
| Set EB env vars | Send all application secrets from CircleCI to the EB environment using `eb setenv key=value` |
| Deploy | `eb deploy` — package and deploy to Elastic Beanstalk |

### `deploy-frontend` _(main branch only)_

| Step | Description |
|---|---|
| Attach workspace | Retrieve compiled `dist/` from the build job |
| AWS setup | Configure credentials from CircleCI env vars |
| Sync to S3 | `aws s3 sync app/frontend/dist/.../browser s3://$S3_BUCKET_NAME --delete --acl public-read` |

---

## Secrets Configured in CircleCI

All secrets are stored in CircleCI as **Project Environment Variables** (Settings → Environment Variables). They are injected at runtime and never appear in source code or logs.

| Variable | Used In |
|---|---|
| `AWS_ACCESS_KEY_ID` | deploy-backend, deploy-frontend |
| `AWS_SECRET_ACCESS_KEY` | deploy-backend, deploy-frontend |
| `AWS_DEFAULT_REGION` | deploy-backend, deploy-frontend |
| `EB_APP_NAME` | deploy-backend |
| `EB_ENV_NAME` | deploy-backend |
| `EB_API_URL` | build-and-test-frontend (injected into Angular production build) |
| `S3_BUCKET_NAME` | deploy-frontend |
| `POSTGRES_HOST` | deploy-backend (forwarded to EB) |
| `POSTGRES_PORT` | deploy-backend (forwarded to EB) |
| `POSTGRES_DB` | deploy-backend (forwarded to EB) |
| `POSTGRES_USER` | deploy-backend (forwarded to EB) |
| `POSTGRES_PASSWORD` | deploy-backend (forwarded to EB) |
| `TOKEN_SECRET` | build-and-test-backend, deploy-backend (forwarded to EB) |
| `BCRYPT_PASSWORD` | build-and-test-backend, deploy-backend (forwarded to EB) |
| `SALT_ROUNDS` | build-and-test-backend, deploy-backend (forwarded to EB) |
| `ACCESS_TOKEN_EXPIRY` | deploy-backend (forwarded to EB) |
| `REFRESH_TOKEN_EXPIRY_DAYS` | deploy-backend (forwarded to EB) |
| `ALLOWED_ORIGIN` | deploy-backend (forwarded to EB) |

---

## How to Set Up the Pipeline from Scratch

1. Push this repository to GitHub.
2. Sign up at [circleci.com](https://circleci.com) and authorize GitHub access.
3. Go to **Projects → Set Up Project** and select this repo.
4. Add all secrets listed above under **Project Settings → Environment Variables**.
5. Push any commit to `main` — CircleCI will pick it up automatically.
