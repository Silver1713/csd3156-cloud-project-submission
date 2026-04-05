# Backend

TypeScript + Express API for Indigo Ledger, a cloud-based inventory management platform.

## Overview

The backend provides:

- Cognito-backed authentication and account resolution
- Organization-scoped role and permission checks
- Product, category, and inventory APIs
- Stock movement and adjustment workflows
- Metrics and alerts APIs
- S3 presigned upload support for product and profile images

## Stack

- Node.js 22
- Express 5
- TypeScript
- PostgreSQL via `pg`
- Zod for request validation

## Project Structure

```text
backend/
├─ public/                 # Static docs pages served by Express
├─ src/
│  ├─ app/                 # Server bootstrap
│  ├─ db/                  # PostgreSQL pool and query helpers
│  ├─ middleware/          # Auth and shared middleware
│  ├─ modules/             # Feature modules
│  ├─ routes/              # Route registration
│  ├─ shared/              # Shared utilities and engines
│  └─ types/               # Shared TypeScript types
├─ package.json
├─ Dockerfile
└─ .env.example
```

## Feature Modules

Current route groups mounted under `/api`:

- `/auth`
- `/users`
- `/organizations`
- `/categories`
- `/inventory`
- `/products`
- `/metrics`
- `/alerts`
- `/uploads`

## Environment Variables

Create `backend/.env` from `backend/.env.example`.

Important values:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `POSTGRES_SSL_URL` or `DATABASE_URL` or `POSTGRES_URL`
- `APP_UUID_SALT`
- `JWT_SECRET`
- `BCRYPT_ROUNDS`
- `AUTH_BACKEND_API`
- `AUTH_ENABLE_BACKEND_API_BYPASS`
- `AWS_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `S3_PRODUCT_IMAGE_BUCKET`
- `S3_PRODUCT_IMAGE_PUBLIC_BASE_URL`
- `DEMO_DEFAULT_ORG_ENABLED`
- `DEMO_DEFAULT_ORG_NAME`
- `DEMO_DEFAULT_ROLE_NAME`
- `CORS_ALLOWED_ORIGINS`

Notes:

- The backend supports either split `DB_*` settings or a single PostgreSQL connection string.
- Cognito configuration is required for the main authentication flow used by the client.
- S3 settings are required for image upload endpoints.

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The backend runs on:

- `http://localhost:3000`

Health check:

- `GET /api/health`

## Production Build

Compile and run the built server:

```bash
npm run build
npm run start
```

## Testing

Run backend tests:

```bash
npm test
```

## Docker

Build the image:

```bash
docker build -t indigo-ledger-backend .
```

Run the container:

```bash
docker run --rm -p 3000:3000 --env-file ./.env indigo-ledger-backend
```

## Database

This service expects a PostgreSQL database configured with the schema in the repository-level [`database/`](../database/) folder.

Important:

- The SQL schema is not applied automatically by this backend service.
- Use `database/db_schema_with_alerts.sql` before running the full API locally.
- Use `database/db_seed_with_alerts.sql` if you want sample data.

## API Highlights

Examples of implemented endpoints:

- `GET /api/health`
- `GET /api/auth/cognito`
- `POST /api/auth/cognito/resolve`
- `PATCH /api/users/me`
- `GET /api/organizations/me`
- `GET /api/products`
- `POST /api/products`
- `GET /api/inventory`
- `POST /api/inventory/movements`
- `GET /api/metrics/inventory/overview`
- `GET /api/alerts`

## Authentication Model

The main application flow is:

1. The client signs in directly with AWS Cognito.
2. The client sends Cognito bearer tokens to the backend.
3. The backend verifies or resolves the session and maps it to local account data.
4. Authorized API requests run with organization-scoped permissions.

## License

MIT
