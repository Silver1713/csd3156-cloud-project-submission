# Client

React frontend for Indigo Ledger, a cloud-based inventory management platform.

## Overview

The client provides:

- Cognito-based sign-in and registration
- Inventory dashboard with charts and alerts
- Product, category, and inventory workflows
- Metrics and alert management pages
- Organization, user, profile, and settings pages

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Recharts

## Project Structure

```text
client/
├─ src/
│  ├─ app/                 # App bootstrap and route shell
│  ├─ components/          # Shared UI components
│  ├─ layouts/             # Main application layout
│  ├─ pages/               # Route-level pages
│  ├─ services/            # API and auth clients
│  └─ styles/             # Global and shared styles
├─ public/
├─ package.json
├─ Dockerfile
└─ .env.example
```

## Environment Variables

Create `client/.env` from `client/.env.example`.

Typical local values:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_COGNITO_USER_POOL_ID=replace-me
VITE_COGNITO_CLIENT_ID=replace-me
```

Notes:

- The checked-in example file currently points at a deployed backend.
- The client uses build-time `VITE_*` values, so Docker images must be rebuilt when these values change.
- Valid Cognito settings are required for the main authentication flow.

## Local Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

Default local URL:

- `http://localhost:5173`

## Production Build

Build the production assets:

```bash
npm run build
```

Preview the built app locally:

```bash
npm run preview
```

## Docker

Build the image:

```bash
docker build -t indigo-ledger-client .
```

Run the container:

```bash
docker run --rm -p 5173:5173 indigo-ledger-client
```

Important:

- The current Dockerfile sets `VITE_*` values during the image build.
- If you want the container to target a different backend or Cognito pool, update those values and rebuild the image.

## Application Areas

Main pages currently included in the app:

- Authentication
- Dashboard
- Products
- Inventory Operations
- Movement Logs
- Inventory Adjustment
- Metrics
- Alerts
- Organization
- User Management
- Profile
- Settings

## Backend Integration

The client communicates with the backend through `/api` endpoints and sends the stored Cognito access token as a bearer token on authenticated requests.

Main integrations:

- Auth session resolution
- Organization summary and member management
- Product and category CRUD
- Inventory reads and stock movement creation
- Metrics and alert definitions
- Presigned upload requests for images

## License

MIT
