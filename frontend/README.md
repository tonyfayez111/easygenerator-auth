# Easygenerator Auth — Frontend

React 19 + Vite + TypeScript frontend for the Easygenerator authentication module.

## Stack

- **React 19** + **Vite**
- **Mantine v9** — UI components
- **Tailwind CSS v3** — layout and spacing
- **TanStack Router** — file-based routing with auth guards
- **TanStack Query** — server state and caching
- **React Hook Form + Zod** — form validation
- **Axios** — HTTP client with Bearer token interceptor and 401 refresh retry

## Local setup

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

The frontend expects the backend running at `http://localhost:3000` by default.
To override, create a `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

## Available scripts

```bash
pnpm dev          # dev server with HMR
pnpm build        # production build
pnpm preview      # preview production build locally
pnpm lint         # ESLint
```

## Project structure

```
src/
├── api/              # Axios instance — withCredentials, Bearer interceptor, 401 retry
├── context/          # AuthContext — in-memory access token + silent refresh
├── features/
│   ├── auth/         # sign-in, sign-up, hooks, API calls, Zod schemas
│   └── user/         # dashboard page, profile hook
├── lib/              # QueryClient config
└── routes/           # TanStack Router file-based routes + auth guards
```
