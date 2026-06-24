# Architecture — Easygenerator Auth App

## Overview

A full-stack user authentication module built as a monorepo. The backend exposes a REST API
(NestJS + MongoDB), and the frontend is a React SPA (Vite + TypeScript) that consumes it.
The auth system implements access + refresh token rotation with a Remember Me flow,
fully aligned with OWASP and NIST security guidelines.

---

## Repository Layout

```
easygenerator-auth/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── dto/                   # Input DTOs with class-validator decorators
│   │   │   │   ├── signup.dto.ts
│   │   │   │   ├── signin.dto.ts
│   │   │   │   └── refresh.dto.ts
│   │   │   ├── schemas/
│   │   │   │   ├── user.schema.ts     # User document
│   │   │   │   └── refresh-token.schema.ts  # Stored refresh token hashes
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts  # Protects access-token endpoints
│   │   │   │   └── refresh.guard.ts   # Reads refresh token from httpOnly cookie
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts    # Validates access token from Bearer header
│   │   │   │   └── refresh.strategy.ts # Validates refresh token from cookie
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── common/
│   │   │   ├── filters/               # HttpExceptionFilter — consistent error shape
│   │   │   ├── interceptors/          # LoggingInterceptor — request/response logging
│   │   │   └── pipes/                 # Already global, listed here for clarity
│   │   ├── app.module.ts
│   │   └── main.ts                    # Helmet, CORS, ValidationPipe, cookie-parser, Swagger
│   ├── test/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.ts               # Axios instance + access token interceptor + refresh retry
│   │   │   ├── auth.ts                # signUp, signIn, signOut, refreshToken, getProfile
│   │   │   └── types.ts
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx        # In-memory access token + silent refresh on mount
│   │   ├── pages/
│   │   │   ├── SignUpPage.tsx
│   │   │   ├── SignInPage.tsx         # Includes Remember Me checkbox
│   │   │   └── AppPage.tsx
│   │   ├── router/
│   │   │   └── index.tsx
│   │   ├── schemas/                   # Zod schemas mirroring backend DTO rules
│   │   └── main.tsx
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── AI.md
├── README.md
└── ARCHITECTURE.md
```

---

## Token Strategy

This is the most security-sensitive design decision in the app. The strategy follows
OWASP JWT Cheat Sheet and OWASP Session Management Cheat Sheet recommendations.

### Token Types

| Token | Lifetime | Purpose |
|---|---|---|
| Access token | 15 minutes | Authorizes API calls — sent as `Authorization: Bearer` header |
| Refresh token | See below | Obtains a new access token — sent automatically via httpOnly cookie |

### Remember Me Behaviour

| | Remember Me OFF | Remember Me ON |
|---|---|---|
| Access token storage | **In-memory only** (React state) | **In-memory only** (React state) |
| Refresh token storage | **httpOnly session cookie** (no `Max-Age` — browser discards it on close) | **httpOnly persistent cookie** (`Max-Age: 7 days`) |
| Session survives page refresh? | Yes (silent refresh on mount) | Yes (silent refresh on mount) |
| Session survives browser close? | No | Yes |

**Access token is ALWAYS stored only in memory.** It is never written to `localStorage`,
`sessionStorage`, or any cookie. This eliminates the largest XSS attack surface per the
OWASP JWT Cheat Sheet.

### Silent Refresh (on page load / token expiry)

```
App mounts
  └─► AuthContext calls GET /auth/refresh
        ├── Browser sends refresh-token cookie automatically
        ├── Backend validates + rotates token
        ├── Returns new access token in response body
        ├── Sets new refresh-token cookie (same persistence as original)
        └── AuthContext stores access token in React state → app is ready

If /auth/refresh returns 401
  └─► AuthContext clears state → ProtectedRoute redirects to /signin
```

### Axios Interceptor — Transparent Retry

```
Request with expired access token → 401 from server
  └─► Axios response interceptor detects 401
        └─► Calls /auth/refresh silently
              ├── Success → retry original request with new token
              └── Failure → call logout(), redirect to /signin
```

### Full Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  SIGNUP                                                         │
│                                                                 │
│  POST /auth/signup { email, name, password }                    │
│    1. Validate DTO                                              │
│    2. Check email uniqueness (generic error — no enumeration)   │
│    3. bcrypt.hash(password, 10)                                 │
│    4. Save User                                                 │
│    5. Generate access token (15 min) + refresh token (uuid v4)  │
│    6. Hash refresh token → save to RefreshToken collection      │
│    7. Set-Cookie: refresh_token=<token>; HttpOnly; ...          │
│    8. Return { access_token } in response body                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SIGNIN                                                         │
│                                                                 │
│  POST /auth/signin { email, password, rememberMe }              │
│    1. Validate DTO                                              │
│    2. Find user — same generic error if not found               │
│    3. bcrypt.compare(password, hash) — constant-time compare    │
│    4. Generate access + refresh tokens                          │
│    5. Hash refresh token → save to RefreshToken collection      │
│    6. Set-Cookie with/without Max-Age based on rememberMe       │
│    7. Return { access_token }                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TOKEN REFRESH (automatic)                                      │
│                                                                 │
│  POST /auth/refresh  (cookie sent automatically by browser)     │
│    1. RefreshGuard extracts token from cookie                   │
│    2. Verify token signature + expiry                           │
│    3. Hash token → look up in RefreshToken collection           │
│    4. If not found → 401 (token was revoked or already rotated) │
│    5. Delete old RefreshToken document (rotation)               │
│    6. Generate new access token + new refresh token             │
│    7. Save new refresh token hash                               │
│    8. Set-Cookie with new refresh token                         │
│    9. Return { access_token }                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LOGOUT                                                         │
│                                                                 │
│  POST /auth/logout  (requires valid access token)               │
│    1. Delete RefreshToken document from DB                      │
│    2. Clear refresh_token cookie (Max-Age: 0)                   │
│    3. Return 200                                                │
│  Frontend: clears in-memory access token → redirects to /signin │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schemas

### User

```ts
{
  _id:       ObjectId
  email:     string     // unique index
  name:      string
  password:  string     // bcrypt hash — plaintext never stored or logged
  createdAt: Date
  updatedAt: Date
}
```

### RefreshToken

```ts
{
  _id:        ObjectId
  userId:     ObjectId   // ref: User
  tokenHash:  string     // SHA-256 of the refresh token — raw token never stored
  expiresAt:  Date       // TTL index — MongoDB auto-deletes expired documents
  createdAt:  Date
}
```

Storing only the **hash** of the refresh token means a database breach does not expose
valid tokens. The TTL index on `expiresAt` keeps the collection clean automatically.

---

## API Endpoints

| Method | Path | Auth | Cookie | Description |
|---|---|---|---|---|
| POST | `/auth/signup` | No | Sets refresh cookie | Register, returns access token |
| POST | `/auth/signin` | No | Sets refresh cookie | Login, returns access token |
| POST | `/auth/refresh` | No (cookie) | Rotates refresh cookie | Returns new access token |
| POST | `/auth/logout` | Yes (Bearer) | Clears refresh cookie | Revokes refresh token |
| GET | `/auth/profile` | Yes (Bearer) | — | Returns current user profile |

---

## Security

### Standards Followed

| Standard | What it covers in this project |
|---|---|
| **OWASP Top 10 (2021)** | Mapped below |
| **OWASP Authentication Cheat Sheet** | Password rules, bcrypt, generic errors, rate limiting |
| **OWASP Session Management Cheat Sheet** | httpOnly cookies, token rotation, logout revocation |
| **OWASP JWT Security Cheat Sheet** | Memory-only access token, short expiry, HS256, no sensitive data in payload |
| **OWASP Secure Headers Project** | Implemented via Helmet.js |
| **NIST SP 800-63B** | Password complexity, minimum length, no truncation |
| **RFC 7519** | JWT structure and claims |
| **RFC 6265 (SameSite)** | `SameSite=Strict` on cookies for CSRF protection |

### OWASP Top 10 (2021) — Implementation Map

| # | Risk | Mitigation |
|---|---|---|
| A01 | Broken Access Control | `JwtAuthGuard` on all protected routes; refresh token revocation in DB |
| A02 | Cryptographic Failures | bcrypt (cost 10) for passwords; SHA-256 for stored refresh token hashes; JWT secret from env |
| A03 | Injection | Mongoose with typed schemas; `class-validator` with `whitelist: true` strips unknown fields |
| A04 | Insecure Design | Token rotation on every refresh; generic auth errors; in-memory access token |
| A05 | Security Misconfiguration | Helmet.js headers; CORS restricted to known origin; Swagger disabled in production |
| A06 | Vulnerable Components | Dependabot / `npm audit` in CI |
| A07 | Auth Failures | Rate limiting on auth endpoints (`@nestjs/throttler`); bcrypt constant-time compare; no user enumeration |
| A08 | Data Integrity | `whitelist: true` on ValidationPipe; no `__proto__` injection via class-transformer |
| A09 | Logging Failures | Winston logs all auth events (signup, signin, refresh, logout, failures) without PII in logs |
| A10 | SSRF | Not applicable — no outbound HTTP calls from backend |

### Security Headers (Helmet.js)

```
Content-Security-Policy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security (HSTS) — production only
Referrer-Policy: no-referrer
X-XSS-Protection: 0  (disabled — browsers handle this; CSP is the real defence)
```

### Cookie Configuration

```
Set-Cookie: refresh_token=<value>;
  HttpOnly;                  // not accessible from JavaScript — blocks XSS token theft
  Secure;                    // HTTPS only (enforced in production)
  SameSite=Strict;           // blocks CSRF — cookie not sent on cross-site requests
  Path=/auth/refresh;        // scoped — cookie only sent to refresh endpoint
  [Max-Age=604800]           // only present when rememberMe=true (7 days)
```

### Rate Limiting (@nestjs/throttler)

| Endpoint | Limit |
|---|---|
| POST `/auth/signup` | 5 requests / minute per IP |
| POST `/auth/signin` | 10 requests / minute per IP |
| POST `/auth/refresh` | 20 requests / minute per IP |

### Additional Measures

- **No user enumeration** — signup and signin return identical generic messages for
  "invalid credentials" / "email already in use" to prevent account discovery
- **No sensitive data in JWT payload** — only `{ sub: userId, email }`; never name,
  password hash, or roles
- **Stack traces stripped** — `HttpExceptionFilter` returns `{ statusCode, message, timestamp }`
  only; no internal details exposed
- **Environment validation** — `@nestjs/config` with Joi schema validates all required
  env vars at startup; app refuses to start with a missing `JWT_SECRET`

---

## Frontend

### Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 | Required by task |
| Build tool | Vite | Fast HMR, minimal config |
| Language | TypeScript | Required by task |
| UI components | Mantine v7 | Rich accessible form components, notifications |
| Styling | Tailwind CSS v3 | Utility-first layout; complements Mantine |
| Routing | React Router v6 | Supports protected routes cleanly |
| Forms | React Hook Form + Zod | Performant, type-safe, mirrors backend validation |
| HTTP client | Axios | Interceptors for Bearer injection and refresh retry |

### Routing

```
/           → redirects to /signin
/signup     → SignUpPage    (public — redirects to /app if already authenticated)
/signin     → SignInPage    (public — redirects to /app if already authenticated)
/app        → AppPage       (protected — redirects to /signin if not authenticated)
```

### Auth State (AuthContext)

```ts
interface AuthContextValue {
  accessToken: string | null      // in memory only — never written to storage
  isLoading: boolean              // true during silent refresh on mount
  login: (token: string) => void
  logout: () => Promise<void>     // calls POST /auth/logout, clears state
}
```

On mount, `AuthContext` calls `POST /auth/refresh`. During this call `isLoading=true`
and `ProtectedRoute` renders a spinner rather than redirecting. This prevents a flash
of the signin page on valid sessions after page refresh.

### Validation (Zod — `src/schemas/`)

```ts
const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[a-zA-Z]/, 'At least one letter')
  .regex(/[0-9]/, 'At least one number')
  .regex(/[^a-zA-Z0-9]/, 'At least one special character')

const signUpSchema = z.object({
  email:    z.string().email('Invalid email'),
  name:     z.string().min(3, 'Minimum 3 characters'),
  password: passwordSchema,
})

const signInSchema = z.object({
  email:      z.string().email('Invalid email'),
  password:   z.string().min(1, 'Required'),
  rememberMe: z.boolean().default(false),
})
```

### API Layer (`src/api/`)

```
axios.ts    — instance with baseURL, withCredentials: true (sends cookies),
              request interceptor injects Bearer token,
              response interceptor retries on 401 via /auth/refresh

auth.ts     — signUp(), signIn(), signOut(), refreshToken(), getProfile()

types.ts    — AuthResponse, UserProfile, SignInPayload, SignUpPayload
```

`withCredentials: true` is required on the Axios instance so the browser includes
the httpOnly refresh-token cookie on cross-origin requests to the backend.

---

## CI/CD — GitHub Actions

```
push to main / any PR
  ├── backend job
  │     npm ci → eslint → jest --coverage
  └── frontend job
        npm ci → tsc --noEmit → eslint → vite build
```

---

## Environment Variables

### Backend (`backend/.env`)

```
MONGODB_URI=mongodb://localhost:27017/easygenerator
JWT_SECRET=<minimum 32-character random string>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:3000
```

---

## Full Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                            │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐ │
│  │ SignUp   │   │ SignIn   │   │ AppPage (protected)  │ │
│  │ Page     │   │ Page     │   │ "Welcome to the app" │ │
│  └────┬─────┘   └────┬─────┘   └──────────┬───────────┘ │
│       │               │                    │             │
│       └───────┬────────┘                   │             │
│               │                            │             │
│         ┌─────▼────────────────────────────▼──────────┐ │
│         │               AuthContext                    │ │
│         │  accessToken: string | null  (memory only)  │ │
│         │  login()  logout()  isLoading                │ │
│         └──────────────────┬───────────────────────────┘ │
│                            │                             │
│              ┌─────────────▼──────────────┐             │
│              │  Axios (withCredentials)    │             │
│              │  Bearer header interceptor │             │
│              │  401 → refresh retry       │             │
│              └─────────────┬──────────────┘             │
└────────────────────────────┼─────────────────────────────┘
                             │ HTTPS
              ┌──────────────▼──────────────────────────────┐
              │              NestJS (port 3000)              │
              │                                             │
              │  Helmet → CORS → cookie-parser              │
              │  → ThrottlerGuard → ValidationPipe          │
              │                                             │
              │  POST /auth/signup  ──► AuthService         │
              │  POST /auth/signin  ──► AuthService         │
              │  POST /auth/refresh ──► RefreshGuard        │
              │                          └─► AuthService    │
              │  POST /auth/logout  ──► JwtAuthGuard        │
              │                          └─► AuthService    │
              │  GET  /auth/profile ──► JwtAuthGuard        │
              │                          └─► AuthService    │
              │                                             │
              │  AuthService                                │
              │   ├── UserModel       (Mongoose)            │
              │   ├── RefreshTokenModel (Mongoose)          │
              │   ├── JwtService      (@nestjs/jwt)         │
              │   └── winston logger                        │
              └──────────────┬──────────────────────────────┘
                             │ Mongoose
              ┌──────────────▼──────────────────────────────┐
              │                  MongoDB                     │
              │   users            refresh_tokens           │
              │   ─────────────   ──────────────────────    │
              │   _id              _id                      │
              │   email (unique)   userId (ref: User)       │
              │   name             tokenHash (SHA-256)      │
              │   password (hash)  expiresAt (TTL index)    │
              │   timestamps       createdAt                │
              └─────────────────────────────────────────────┘
```

---

## What Is NOT in Scope

- Email verification
- Password reset / forgot password
- Role-based access control (RBAC)
- Multi-tenancy
- OAuth / social login
- Docker / containerization (README covers local setup only)
- Access token blocklist (refresh token revocation in DB covers the main logout case)
