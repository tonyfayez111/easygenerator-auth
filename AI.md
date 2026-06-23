# AI.md — AI Assistance Log

This file documents how AI assistance (Claude Code — claude-sonnet-4-6) was used throughout
the development of this task. It covers which parts were AI-generated, which prompts were
effective, what needed correction or rework, and where human judgment overrode AI suggestions.

This is a living document — updated continuously as development progresses.

---

## Tool Used

- **AI Assistant:** Claude Code (claude-sonnet-4-6) via Anthropic
- **Interface:** Claude Code CLI / Desktop App
- **Date started:** 2026-06-23

---

## Phase 1 — Architecture & Planning

### What was AI-assisted

**Prompt used:**
> "I shared the task PDF. What can we do regarding this? Walk me through architecture before
> doing anything."

**What Claude generated:**
- Full monorepo folder structure (backend + frontend)
- Technology selection table with rationale for each choice (Mongoose, Passport JWT,
  React Hook Form + Zod, Mantine + Tailwind, Axios, Winston, Swagger)
- Auth flow sequence diagram (signup → hash → JWT → return token)
- JWT configuration decisions (HS256, 7-day expiry, env-based secret)
- Validation rule mapping between backend DTOs and frontend Zod schemas
- Security measures list (bcrypt cost factor, whitelist pipe, CORS config)
- Full data flow diagram from browser → AuthContext → Axios → NestJS → MongoDB
- CI/CD GitHub Actions job outline
- Explicit "out of scope" section to keep boundaries clear

**Output:** `ARCHITECTURE.md`

### What was effective

- Asking for architecture conversation *before* any code was written prevented expensive
  mid-build direction changes.
- Requesting a data flow diagram made the token lifecycle and protected route logic
  immediately clear.
- The technology rationale table gave concrete justification for each library choice —
  useful for explaining decisions during code review.

### Human decisions / overrides

- **Tailwind + Mantine combo** was the human's choice, not AI's initial suggestion.
  Claude's first option was Tailwind only; the user added Mantine for richer form
  components and notifications.
- **Conversation-first approach:** Claude's default would have been to start generating
  code immediately. The human explicitly asked to discuss architecture first — this was
  the right call and prevented costly mid-build rework.

### What needed correction / rework

- Nothing required correction at this stage. The architecture document was accepted as
  proposed after review.

---

## Phase 1b — Security Architecture Revision

### What triggered this phase

The human asked to add refresh tokens + Remember Me functionality and to verify the
design against OWASP and other security standards before writing any code.

**Prompt used:**
> "i need also refresh token also with remember me so i need the access token to be in
> session if remember me not selected and in http only cookies if remember me is selected
> in order to be more secure and also check OWASP security standards and if there are
> any other security standards i have to follow just tell me"

### What Claude generated

- Full revised token strategy section in ARCHITECTURE.md
- Access token: **always in-memory only** (React state) — AI upgraded the human's
  initial idea of sessionStorage to in-memory, explaining that sessionStorage is still
  XSS-accessible
- Refresh token: **always httpOnly cookie** — persistent vs. session based on Remember Me
- Token rotation on every refresh (prevents refresh token replay)
- Refresh token stored as **SHA-256 hash** in a dedicated MongoDB collection (TTL index
  for auto-cleanup)
- Silent refresh flow on page mount with `isLoading` state to prevent signin flash
- Axios 401 retry interceptor for transparent token refresh
- Full OWASP Top 10 (2021) mapping table
- Additional standards: NIST SP 800-63B, RFC 7519, RFC 6265 (SameSite cookies)
- Cookie security attributes: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth/refresh`
- Rate limiting table per endpoint via `@nestjs/throttler`
- Helmet.js security headers list
- No user enumeration policy (generic error messages)
- Environment variable validation via Joi at startup

### What was effective

- Asking Claude to check OWASP *before* coding surfaced several issues that would have
  required rework: sessionStorage vulnerability, missing token rotation, no revocation
  mechanism, no rate limiting.
- Framing the request as "tell me what standards I have to follow" prompted a full
  multi-standard review rather than just fixing the immediate localStorage/cookie question.

### Human decisions / overrides

- **Access token storage upgrade:** Human proposed sessionStorage (no Remember Me) /
  httpOnly cookie (Remember Me). Claude recommended in-memory for the access token in
  both cases — this is the OWASP-recommended pattern and the human accepted it.
- **Scope decision:** Human chose to add refresh tokens even though the original task
  did not require them. This is a deliberate upgrade to demonstrate production-readiness.
- **Cookie path scoping:** Claude added `Path=/auth/refresh` to the cookie — human
  accepted this as it limits the cookie to only the refresh endpoint, reducing exposure.

### What needed correction / rework

- Initial architecture had a single JWT with 7-day expiry and no refresh mechanism.
  This was replaced with a 15-minute access token + rotating refresh token — a
  significant security improvement that required updating the database schema,
  API endpoints table, and the full data flow diagram.

---

## Phase 2 — Backend Implementation

### How I used AI

I started by telling Claude to kick off the implementation. My first prompt was:

> "lets start the implementation now but i believe it will be more useful if we used pnpm instead of npm"

Claude scaffolded the full NestJS project, Mongoose schemas, DTOs, AuthService,
strategies, guards, filters, interceptors, and main.ts wiring. The initial scaffold was
generated all at once using the ARCHITECTURE.md as the spec.

### Prompts that triggered specific decisions

When I noticed the project had a `package.json` at the root level (which doesn't scale):

> "first of all why i have package.json ..etc outside the repos? i need frontend and backend
> standalone in order to be scalable please also change required changes in ci.yml for github
> workflows"

Claude moved everything to proper standalone `backend/` and `frontend/` directories.

When I noticed Claude put the profile endpoint inside the auth module and kept raw
`@ApiResponse` decorators on every controller despite having an exception filter:

> "first of all why i have profile in auth? please i need to create user entity in order to
> have profile in it by get:id, second why when i have exception filter i still use
> @ApiResponse while i can categorize the status and just send the param as variable to the
> function and handle this in exception filter so this will be centralized? 3- in frontend
> please lets use tanstackquery instead of direct axios in order to have the required cached
> data."

This triggered three changes: User moved to its own module, a custom `@ApiResponses`
decorator was created to centralize Swagger docs, and TanStack Query was added to the
frontend plan.

I caught that the refresh token was being stored as a plain cookie, not httpOnly:

> "why i have refresh token in cookies instead of http only cookies? i need to protect my app
> from XSS and CSRF attack please"

Then I questioned the refresh token type choice:

> "why we can not instead implement refresh token as jwt and continue in this"

Claude explained the trade-offs. I followed up:

> "what is the most secure way and why?"

After understanding the comparison — JWT refresh tokens can't be revoked, raw opaque tokens
can — I made the call:

> "so lets do it raw Opaque tokens but please need file for ADR for this please"

This is when `docs/ADR-001-REFRESH-TOKEN-STRATEGY.md` was created.

### What I caught and corrected

**TypeScript DTO initialization errors.** I hit this compiler error and brought it to Claude:

> "check this error please for constructing in dtos — Property 'email' has no initializer
> and is not definitely assigned in the constructor."

**Remember Me not working correctly.** After testing, I found sessions were persisting even
without Remember Me checked:

> "why when i closed the session while i did not press remember me i am still logged in?"

The backend was setting a 24-hour expiry regardless. Fixed to 1 hour for non-Remember Me.

**Sign-in button stuck loading.** After implementing the full flow I saw this bug:

> "when i try to login it keep loading instead of showing notification, (please test all
> scenarios and edge and corner cases in order to work)"

Root cause: the Axios 401 interceptor was treating the signin endpoint's own 401 (wrong
password) as an expired token and trying to refresh — which also failed — and the error
was swallowed. Fixed by checking whether an access token actually exists before attempting
a refresh.

**Sliding session idea.** Once the basic refresh was working, I asked about a feature I
had seen in enterprise apps:

> "can we do this Refresh Token Rotation + Sliding Session or this is hard to be done?"

Claude explained it was doable. I confirmed:

> "lets do it, yes. i need it for refresh token itself — every time the user refreshes their
> session you issue a new access token, new refresh token, and invalidate the old refresh token"

**Winston logger was planned but missing.** I caught this late in the session:

> "btw we supposed to use winston logger why did we not use it?"

It was wired in but the LoggingInterceptor was still using NestJS's built-in Logger.
Claude updated it to use nest-winston for structured logging.

### What was effective

Bringing the ARCHITECTURE.md to Claude before each prompt phase meant it had full context
and the generated code matched the agreed design. When I skipped that context and just
asked for a specific fix, I got more rework. The biggest time-saver was the typed
`ErrorCode` enum — having all error types defined up front meant every auth error path
was consistent without chasing down strings later.

---

## Phase 3 — Frontend Implementation

### How I used AI

The frontend had the most back-and-forth of any phase. The initial scaffold was
AI-generated but I kept steering the structure toward patterns I already knew from
previous projects.

**Router choice.** My architecture doc said React Router v6, but when we got to
implementation I changed my mind:

> "also need instead of router need routes and have authenticated and unauthenticated routes
> in it please, which is TanStack Router's file-based routing system"

Then I pushed further to make the router setup simple and clean:

> "i need to use router tree like this example:
> `const router = createRouter({ routeTree });`
> `<RouterProvider router={router} />`
> in order to have all routes and use Link from tanstack/react-router please"

**Folder structure.** After the first scaffold, mutations were scattered directly in
components. I pushed back:

> "why i have usemutation in the component itself, please i need to have convenient folder
> structuring in frontend which each entity has folder and this folder has components folder,
> hooks folder, types folder, in order to have a structured frontend please"

I then showed Claude a concrete example of the enterprise folder structure I wanted
(`features/auth/`, `features/user/` with co-located components, hooks, api, types).

**API client pattern.** I noticed the API calls were using raw axios inline. I showed
Claude the factory pattern I preferred:

> "why i have in api.ts using axios this way — why do we not have ApiClient like
> `export const ApiClient = axios.create({ baseURL, paramsSerializer: ... })`
> instead of doing it the way implemented now?"

**Separating user concerns.** Profile data was mixed with auth state:

> "i need profile to be in user separate in order to have separate concerns in frontend
> and backend please"

**Route-level auth guards.** Pages were doing their own auth checks with `if (!accessToken) navigate(...)`:

> "instead of using this in pages itself can we do it in routes using beforeLoad and redirect
> async if condition redirect?"

**Password validation.** I wanted the signup form to match the backend rules exactly:

> "in signup i need please to make sure for fields to have same secure validation in front
> and back end and i want confirm password field and need strong detector component as i need
> the password to be strong to be saved please"

### Problems I hit and how they were resolved

**React Compiler errors.** I ran a full production lint and got two errors I brought to Claude:

> "Compilation Skipped: Use of incompatible library — React Hook Form's `useForm()` returns
> a `watch()` function which cannot be memoized safely"

> "Error: Cannot call impure function during render — `Date.now` is an impure function.
> D:\...useSlidingSession.ts:15:26 — let lastActivityTime = Date.now()"

For `watch()`, the fix was switching to `useWatch` (React Compiler compatible).
For `Date.now()`, the fix was initializing with `useRef<number>(0)` and setting
`lastActivityTime.current = Date.now()` inside a `useEffect`.

**`confirmPassword` being sent to backend.** After adding the confirm password field:

> "when i try to signup now i have property confirm password should not exist"

The Zod schema had the field but the backend DTO's ValidationPipe was rejecting it.
I clarified this was supposed to be a frontend-only field:

> "it is supposed to be frontend validation btw"

The fix was stripping `confirmPassword` before the API call using
`{ confirmPassword: _, ...payload }`.

**Fast Refresh rule violation.** `AuthContext.tsx` was exporting both the context object
and the hook — React Fast Refresh requires `.tsx` files to export only components.
Solved by moving `AuthContext` and `useAuth` to a `.ts` file (`context/useAuth.ts`).

**TypeScript strict mode audit.** I asked Claude to check for `any` types:

> "can we check if we have any type in order to be sure about typing in our project?"

Found several implicit `any` casts in cookie access and axios error handlers. All fixed
with explicit type assertions.

### What was effective

Showing Claude a reference folder structure from another project I knew gave it a concrete
target to aim for — it replicated the pattern faithfully rather than making its own choices.
The same worked for the `ApiClient` factory pattern. Concrete examples beat abstract
descriptions every time.

---

## Phase 4 — CI/CD, Docker & Documentation

### How I used AI

Docker and CI/CD were out of scope in the original task spec, but I decided to add
them to demonstrate production-readiness. The prompt was:

> "ok can we please make a dockerfile and dockercompose in order to create container for
> frontend and backend and db, that front can talk to backend, backend can talk to front
> and db, db can talk to backend and put variables used please in order to just docker
> compose up — the one who will have the project can run and use. This files are in the
> root folder which is D:\Easygenerator task\easygenerator-auth, also if there are any
> changes to be done in github workflow ci/cd"

Claude generated multi-stage Dockerfiles for both services, an nginx.conf for the SPA,
a docker-compose.yml with MongoDB, and an updated GitHub Actions CI workflow using pnpm.

I also noticed the docs folder was missing a README:

> "i need readme file for root to illustrate how to start the project, for frontend and
> backend if needed please"

### What I questioned and changed

I verified MongoDB was included in the compose setup:

> "is it creating container for mongo also so db can connect it?"

I also noticed `VITE_API_URL` was being treated as a runtime environment variable in the
Dockerfile, but Vite bakes env vars at build time — it needs to be a Docker build ARG,
not an ENV. Claude updated the Dockerfile accordingly.

### What was effective

Giving Claude the exact root path (`D:\Easygenerator task\easygenerator-auth`) and the
exact pnpm version (11.1.3) upfront meant the Dockerfiles used the right package manager
commands without needing corrections.

---

## Final Summary

### Overall breakdown

| Category | Estimated % AI-generated | Notes |
|---|---|---|
| Project architecture | ~80% | Human drove conversation direction; AI produced the docs |
| Backend boilerplate | ~90% | Scaffold, DTOs, guards, filters — standard NestJS patterns |
| Backend business logic | ~60% | Token rotation, rememberMe inference, email normalization — required human correction |
| Frontend scaffolding | ~85% | Vite setup, context, interceptor |
| Frontend UI / forms | ~70% | Human directed structure, patterns, and component split |
| Validation logic | ~75% | Schemas mirroring DTO rules was AI; stripping confirmPassword required human fix |
| Tests | ~80% | Scaffold was AI; test data structure was corrected to inline-per-test |
| CI/CD + Docker | ~85% | Human caught VITE_API_URL build-time vs runtime issue |
| Documentation | ~65% | ADR structure was AI; decisions and rationale were human |

### Key lessons

The most important thing I learned was to always give Claude context before asking for
code. Every time I opened a prompt with the architecture document or a reference example,
the output was close to what I wanted. Every time I asked a narrow question without that
context, I got more rework.

Concrete examples work better than abstract descriptions. When I showed Claude the folder
structure I wanted (with actual path names and file examples from another project), it
replicated it precisely. When I described it in words, it guessed.

Running a production build check (`pnpm build`, TypeScript strict mode) early exposed
real issues — React Compiler violations, implicit `any` types, Fast Refresh rule
violations — that would have been harder to debug after the fact.

### What I would do differently

I would enforce strict TypeScript from the very start of scaffolding, not add it at the
end. Several issues (Mongoose schema initializers, `any` types in cookie access) only
surfaced when I turned on `"strict": true` late in the project. Starting strict would
have made those errors show up immediately and made every generated file correct from
the beginning.

I would also document decisions in real time as I made them instead of doing it as a
separate pass — the ADR for refresh token strategy was written in context, which made
it much more accurate than trying to reconstruct it later.

---

## Notes on AI-First Engineering Approach

The strategy for this task was to use AI as a **force multiplier**, not a replacement
for engineering judgment. Concretely:

- AI handles **scaffolding, boilerplate, and validation logic** — areas where speed
  matters and patterns are well-established.
- Human handles **architecture direction, library choices, scope decisions, and review**
  of every generated output before it is accepted.
- Every AI output was read and understood before being committed — nothing was blindly
  accepted.
- Prompts were crafted to be specific and context-rich, referencing the exact task
  requirements rather than asking generic questions.
