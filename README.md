# Easygenerator Auth

A production-ready full-stack authentication module built as a take-home task.
Covers sign-up, sign-in, JWT access + refresh token rotation, Remember Me, sliding sessions, and OWASP-compliant security.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS · MongoDB · Passport.js · JWT |
| Frontend | React 19 · Vite · Mantine v9 · TanStack Router · React Query |
| Package manager | pnpm 11 |

---

## Quick start — Docker Compose

> Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd easygenerator-auth

# 2. Create your env file and set a strong JWT secret
cp .env.example .env
# Edit .env — change JWT_SECRET to at least 32 random characters

# 3. Build and start everything (MongoDB + Backend + Frontend)
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api |

To stop: `docker compose down`
To stop and delete the database volume: `docker compose down -v`

---

## Manual setup — local development

### Prerequisites

- Node.js 22+
- pnpm 11 (`npm install -g pnpm@11.1.3`)
- MongoDB running locally on port 27017

### Backend

```bash
cd backend
pnpm install

# Create the env file
cp .env.example .env   # or create backend/.env manually (see below)

pnpm start:dev         # http://localhost:3000
```

**`backend/.env`**

```env
MONGODB_URI=mongodb://localhost:27017/easygenerator
JWT_SECRET=change_me_to_at_least_32_random_characters
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### Frontend

```bash
cd frontend
pnpm install

# Optional: create frontend/.env if your backend runs on a different port
# VITE_API_URL=http://localhost:3000

pnpm dev               # http://localhost:5173
```

---

## Environment variables reference

### Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes (min 32 chars) | — | Secret used to sign access tokens |
| `JWT_ACCESS_EXPIRATION` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRATION` | No | `7d` | Refresh token lifetime (Remember Me) |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |

### Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3000` | Backend base URL |

---

## Available scripts

### Backend (`cd backend`)

```bash
pnpm start:dev    # dev server with watch mode
pnpm build        # compile to dist/
pnpm start:prod   # run compiled output
pnpm test         # unit tests (Jest)
pnpm test:e2e     # end-to-end tests
pnpm test:cov     # test coverage report
pnpm lint         # ESLint
```

### Frontend (`cd frontend`)

```bash
pnpm dev          # dev server (Vite, port 5173)
pnpm build        # production build
pnpm preview      # preview the production build locally
pnpm lint         # ESLint
```

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | None | Register — returns `access_token` + sets refresh cookie |
| `POST` | `/auth/signin` | None | Login — `rememberMe` controls cookie persistence |
| `POST` | `/auth/refresh` | Refresh cookie | Rotate refresh token, get new access token |
| `POST` | `/auth/logout` | Bearer token | Revoke refresh token and clear cookie |
| `GET` | `/auth/profile` | Bearer token | Returns `{ id, email, name }` |
| `GET` | `/users/me` | Bearer token | Same as profile, from user module |

Full interactive docs available at **http://localhost:3000/api** (development only).

---

## Token strategy

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 min | In-memory only (React state) |
| Refresh token | 7 d (Remember Me) / 1 h (session) | `httpOnly; Secure; SameSite=Strict` cookie |

Refresh tokens are stored as SHA-256 hashes in MongoDB with a TTL index.
Every `/auth/refresh` call rotates the token — the old one is immediately invalidated.

---

## Project structure

```
easygenerator-auth/
├── backend/
│   ├── src/
│   │   ├── auth/           # guards, strategies, DTOs, service, controller
│   │   ├── user/           # user schema, controller
│   │   ├── common/         # exceptions, filters, decorators, interceptors
│   │   └── app.module.ts
│   └── test/               # e2e tests
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/       # sign-in, sign-up, hooks, API, types
│   │   │   └── user/       # dashboard, profile hooks
│   │   ├── routes/         # TanStack Router file-based routes
│   │   ├── context/        # AuthContext — in-memory token + silent refresh
│   │   └── api/            # Axios instance with 401 retry interceptor
│   └── public/
├── docs/                   # Architecture decision records
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci.yml
```

---

## Security highlights

- Passwords hashed with bcrypt (cost 10)
- Access tokens never touch `localStorage` or `sessionStorage`
- Refresh tokens stored as SHA-256 hashes — raw token never persisted
- Token rotation on every refresh call
- Rate limiting on auth endpoints (10 req / 60 s)
- Helmet.js security headers
- Generic auth error messages to prevent user enumeration
- `whitelist: true` on all DTOs to strip unknown fields
