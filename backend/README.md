# Backend Structure

## Purpose
This backend layout is designed for a modular inventory management API with JWT authentication, organization-scoped RBAC, and PostgreSQL-backed business data.

It separates feature modules from cross-cutting concerns so authentication, authorization, inventory movement, and audit logic remain maintainable as the system grows.

## Recommended Structure
```text
backend/
  src/
    app/                  # App bootstrap and server composition
    config/               # Environment loading, service config, feature flags
    common/
      constants/          # Shared constants and enums
      errors/             # Application and domain error types
      utils/              # Shared utility helpers
    db/                   # Runtime database client and query helpers
    middleware/           # Auth, error handling, request context, validation
    modules/
      auth/               # Login, token handling, auth providers, session flows
      users/              # User profile and internal user operations
      organizations/      # Organization and membership operations
      products/           # Product CRUD and product rules
      inventory/          # Stock movements, adjustments, transfers, stock reads
      audit/              # Audit trail queries and logging helpers
    routes/               # Route registration and module route composition
    types/                # Shared request or external contract types
  tests/
    unit/                 # Fast isolated tests
    integration/          # API, database, and workflow tests
  scripts/                # Developer and deployment scripts
```

## Module Guidelines
Each module should own its own:

- `controllers/` for HTTP request handling
- `services/` for business logic
- `repositories/` for database access
- `dto/` for request and response contracts
- `types/` when module-specific types are needed

This keeps the code organized by business capability instead of by technical layer only.

## Auth and Authorization Placement
The `auth` module should handle:

- Login and token verification
- Integration with the selected identity provider such as Cognito
- Mapping authenticated identities into application users

Authorization should not live only inside `auth`. Organization-scoped RBAC checks should be enforced in middleware and service-level business logic using membership and permission data from the `organizations` domain.

## Suggested Next Files
The next practical files to add are:

- `src/app/server.ts`
- `src/app/app.ts`
- `src/config/env.ts`
- `src/middleware/authenticate.ts`
- `src/middleware/authorize.ts`
- `src/routes/index.ts`
- `src/modules/auth/auth.routes.ts`
- `src/modules/inventory/inventory.routes.ts`
- `src/db/client.ts`

## Design Notes
- Keep the backend stateless and rely on JWTs for authentication context.
- Keep tenant resolution explicit on every protected request.
- Keep database access behind repositories or data-access services.
- Keep audit and inventory movement rules in the backend, not in the client.

## Database Boundary
The project-level [`database/`](../database/) folder should remain the source of truth for SQL schema, seed data, and database container setup.

The backend should only contain runtime database integration such as:

- connection setup
- query helpers or ORM configuration
- transaction helpers
- repository implementations

If future seeding or migration execution is automated through JavaScript or TypeScript, that logic can be added under `backend/scripts/` or `backend/src/db/`, but the SQL assets should still remain centralized under the project-level `database/` directory.

## How To Start Locally
From the `backend/` folder:

```powershell
npm install
npm run dev
```

Current script behavior:
- `npm run dev` runs TypeScript directly with `tsx`
- `npm run build` compiles TypeScript into `dist/`
- `npm run start` runs the compiled JavaScript from `dist/app/server.js`

If you want the production-style local flow instead:

```powershell
npm run build
npm run start
```

## Relevant Environment Variables
The backend currently expects these runtime variables for auth and demo provisioning:

- PostgreSQL connection via either `POSTGRES_SSL_URL`, `DATABASE_URL`, or `POSTGRES_URL`
- Split PostgreSQL fields via `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Optional PostgreSQL SSL overrides via `DB_SSL` and `DB_SSL_REJECT_UNAUTHORIZED`
- `JWT_SECRET`
- `AWS_REGION`
- `S3_PRODUCT_IMAGE_BUCKET`
- `S3_PRODUCT_IMAGE_PUBLIC_BASE_URL` optional override for public image URLs
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `DEMO_DEFAULT_ORG_ENABLED`
- `DEMO_DEFAULT_ORG_NAME`
- `DEMO_DEFAULT_ROLE_NAME`

Demo default-org behavior is disabled by default. When `DEMO_DEFAULT_ORG_ENABLED=true`, first-time Cognito users are provisioned into the shared demo organization and assigned the configured demo role name with owner-equivalent permissions.

For managed PostgreSQL providers that hand out SSL-only links, set one of the URL variables above directly. `POSTGRES_SSL_URL` is checked first, then `DATABASE_URL`, then `POSTGRES_URL`. If the URL contains `ssl=true` or `sslmode=require`, the backend enables TLS automatically. Use `DB_SSL_REJECT_UNAUTHORIZED=false` when the provider requires SSL but does not provide a CA chain the runtime can verify.

## How To Run With The Local Database
From the project root, start PostgreSQL first:

```powershell
docker compose up --build
```

Then in a separate terminal:

```powershell
cd backend
npm install
npm run dev
```

This backend is no longer just a scaffold. The current codebase includes working auth, users, organizations, products, and inventory modules with PostgreSQL-backed services and route protection.

## Available Routes

Current Express routes mounted by the backend:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Landing page with quick docs |
| `GET` | `/auth` | Auth documentation page |
| `GET` | `/users` | Users documentation page |
| `GET` | `/organizations` | Organizations documentation page |
| `GET` | `/products` | Products documentation page |
| `GET` | `/inventory` | Inventory documentation page |
| `GET` | `/api/health` | Backend + DB health check |
| `GET` | `/api/auth/accounts` | Protected account listing using Cognito or backend bearer tokens |
| `GET` | `/api/auth/cognito` | Cognito status for the preferred direct client flow |
| `POST` | `/api/auth/cognito/verify` | Verify Cognito access token without provisioning |
| `POST` | `/api/auth/cognito/resolve` | Verify Cognito tokens and resolve or provision local account state |
| `POST` | `/api/auth/cognito/login` | Deprecated backend-managed Cognito login compatibility endpoint |
| `POST` | `/api/auth/cognito/register` | Deprecated backend-managed Cognito registration compatibility endpoint |
| `POST` | `/api/auth/backend/login` | Deprecated local backend login compatibility endpoint |
| `POST` | `/api/auth/backend/register` | Deprecated local backend registration compatibility endpoint |
| `POST` | `/api/auth/login` | Deprecated alias for local backend login |
| `PATCH` | `/api/users/me` | Update the authenticated user's profile fields |
| `GET` | `/api/organizations/me` | Get the current organization summary |
| `GET` | `/api/organizations/me/members` | List members in the current organization |
| `GET` | `/api/organizations/me/members/count` | Count members in the current organization |
| `GET` | `/api/metrics/catalog` | Get the backend base-metric catalog for custom metric builders |
| `GET` | `/api/metrics/definitions` | List current organization custom metric definitions |
| `POST` | `/api/metrics/definitions` | Create a current organization custom metric definition |
| `GET` | `/api/metrics/inventory/overview` | Get org-scoped inventory overview metrics |
| `GET` | `/api/metrics/inventory/movement-trend?days=7|14|30` | Get daily inbound/outbound movement buckets |
| `GET` | `/api/metrics/inventory/movement-summary?productId=<uuid>&days=30` | Get movement totals for the org or one product |
| `GET` | `/api/metrics/inventory/category-breakdown?top=3` | Get value breakdown by category with optional top folding |
| `GET` | `/api/alerts/definitions` | List organization alert definitions |
| `GET` | `/api/alerts/definitions/:alertDefinitionId` | Retrieve one organization alert definition |
| `POST` | `/api/alerts/definitions` | Create an organization alert definition |
| `PATCH` | `/api/alerts/definitions/:alertDefinitionId` | Update an organization alert definition |
| `DELETE` | `/api/alerts/definitions/:alertDefinitionId` | Delete an organization alert definition |
| `GET` | `/api/alerts` | List persisted alert records in the current organization |
| `GET` | `/api/alerts/:alertId` | Retrieve a single persisted alert record |
| `POST` | `/api/alerts` | Create a persisted alert record |
| `PATCH` | `/api/alerts/:alertId` | Update a persisted alert record |
| `DELETE` | `/api/alerts/:alertId` | Delete a persisted alert record |
| `POST` | `/api/organizations` | Create a new organization and switch the current account into it as owner |
| `PATCH` | `/api/organizations/:organizationId` | Update the current organization |
| `DELETE` | `/api/organizations/:organizationId` | Delete the current organization |
| `POST` | `/api/uploads/products/presign` | Create a presigned S3 upload URL for a product image |
| `GET` | `/api/products` | List org-scoped products |
| `GET` | `/api/products/:productId` | Retrieve a single org-scoped product |
| `POST` | `/api/products` | Create a product scoped to the authenticated account's organization |
| `PUT` | `/api/products/:productId` | Update product details within the current organization |
| `GET` | `/api/inventory` | List inventory summaries for the current organization |
| `GET` | `/api/inventory/summary` | Product + inventory quantity snapshot |
| `GET` | `/api/inventory/:productId` | Retrieve one product's inventory summary |
| `POST` | `/api/inventory` | Create an inventory balance row for a product |
| `PATCH` | `/api/inventory/:productId` | Update an inventory balance row |
| `DELETE` | `/api/inventory/:productId` | Delete an inventory balance row |
| `GET` | `/api/inventory/movements` | List stock movements with filters and pagination |
| `POST` | `/api/inventory/movements` | Record a new stock movement and update quantity |

`POST /api/inventory/movements` expects a JSON payload:

```json
{
  "productId": "uuid",
  "type": "STOCK_IN",
  "quantity": 5
}
```

Movement types currently supported: `STOCK_IN`, `STOCK_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`.

`GET /api/products` accepts these optional query parameters:

- `limit` default `50`, max `200`
- `offset` default `0`
- `q`
- `sku`
- `createdFrom`
- `createdTo`

Product list response shape:

```json
{
  "products": [
    {
      "id": "uuid",
      "ownerId": "uuid",
      "name": "Widget A",
      "description": "Main warehouse item",
      "sku": "WIDGET-A",
      "createdAt": "2026-03-28T00:00:00.000Z",
      "updatedAt": "2026-03-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

`GET /api/inventory/movements` accepts these optional query parameters:

- `limit` default `50`, max `200`
- `offset` default `0`
- `productId`
- `actorId`
- `type`
- `createdFrom`
- `createdTo`

Movement list response shape:

```json
{
  "movements": [
    {
      "id": "uuid",
      "ownerId": "uuid",
      "actorId": "uuid",
      "productId": "uuid",
      "productName": "Widget A",
      "type": "STOCK_IN",
      "quantity": 10,
      "createdAt": "2026-03-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

## Auth Status

The preferred authentication architecture is now:

- client signs in directly with Cognito
- client sends Cognito bearer tokens to the backend
- backend verifies or resolves the session with `/api/auth/cognito/verify` or `/api/auth/cognito/resolve`

Older backend-managed auth endpoints remain available only as deprecated compatibility routes and should not be used for new integration work.

## Current Testing Status

Current module-level tests cover:

- auth service
- users service
- organizations service
- metrics DTO and service
- alerts DTO and service
- product DTO and service
- inventory DTO and service

Last confirmed backend test result:

- `92` passed
- `0` failed

## Docker
Build the backend image from the project root:

```powershell
docker build -t inventory-backend ./backend
```

Run the backend container:

```powershell
docker run --rm -p 3000:3000 inventory-backend
```

The current backend Dockerfile:
- installs dependencies
- copies the TypeScript source
- builds with `tsc`
- starts the compiled backend
- prints the backend port before startup

## Short Technical Section
Current backend tooling:

- TypeScript
- Node.js
- `tsx` for development-time TS execution
- `tsc` for TypeScript compilation
- Docker for containerization
- `zod` for validation

Planned runtime additions:

- HTTP framework such as Express or Fastify
- PostgreSQL access through `pg`
- environment configuration loading
- authentication and authorization middleware
- feature modules for accounts, products, inventory, stock movements, alerts, and dashboard metrics

## Short Deployment Notes
For local development, use the root `docker-compose.yml` for PostgreSQL and run the backend separately from `backend/`.

For cloud deployment later, the expected backend flow is:

- build the backend image
- provide runtime environment variables
- connect the backend to a managed PostgreSQL instance
- expose the backend through the chosen cloud compute platform
