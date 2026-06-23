# Authentication Security Flow

## Current Token Strategy

### Token Types & Storage

| Token | Type | Storage | Lifetime | Purpose |
|---|---|---|---|---|
| **Access Token** | JWT | **In-memory only** (React state) | 15 minutes | API authentication |
| **Refresh Token** | Raw 64-byte hex | **httpOnly cookie** | 7d or session | Silent token rotation |

## Security Architecture

### 1. XSS (Cross-Site Scripting) Protection ✅

**Problem:** Attacker injects malicious script to steal tokens from localStorage.

**Solution Implemented:**
```
Access Token → Stored in React memory ONLY (never accessible to JavaScript)
              ↓
              Cannot be stolen by XSS attacks

Refresh Token → Stored in httpOnly cookie (inaccessible to JavaScript)
               ↓
               Browser automatically sends it with requests
               ↓
               Cannot be stolen or accessed by any JavaScript code
```

**How it works:**
- Frontend stores access token in `AuthContext` state (memory)
- Axios interceptor reads from memory and adds to `Authorization` header
- Refresh token is in httpOnly cookie:
  ```
  Set-Cookie: refresh_token=<64-byte-token>; 
              HttpOnly;           // ← JavaScript cannot access
              Secure;             // ← HTTPS only in production
              SameSite=Strict;    // ← CSRF protection
              Path=/auth/refresh  // ← Sent only to /auth/refresh endpoint
  ```
- Even if attacker runs JavaScript on the page, they cannot read the token

### 2. CSRF (Cross-Site Request Forgery) Protection ✅

**Problem:** Attacker tricks user into making unwanted requests from another site.

**Solution Implemented:**

**A. SameSite=Strict Cookie Attribute**
```
When user is on attacker.com:
  → All requests to api.example.com
  → refresh_token cookie is NOT sent
  → Attack fails because server requires valid refresh token
```

Breakdown:
- `SameSite=Strict` - Cookie only sent from same-site requests
- Browser won't send the cookie on cross-origin requests
- Malicious form submissions, image tags, etc. cannot access the cookie

**B. Path Restriction**
```
refresh_token cookie has Path=/auth/refresh
  → Cookie only sent to /auth/refresh endpoint
  → Other endpoints cannot access the refresh token
  → Reduces attack surface
```

**C. API Method Restrictions**
```
POST /auth/refresh - Requires valid refresh token (in httpOnly cookie)
POST /auth/logout  - Requires valid access token (in Authorization header)
GET  /users/:id    - Requires valid access token (in Authorization header)
```
- Refresh endpoint requires cookie (automatic browser behavior)
- Other endpoints require Bearer token in Authorization header
- Cannot be set via form submission (which only sends cookies)

### 3. Token Exposure Prevention ✅

**NEVER stored in:**
- ❌ localStorage (XSS vulnerability)
- ❌ sessionStorage (XSS vulnerability)
- ❌ Regular cookies (JavaScript can read)
- ❌ URL parameters (exposed in logs/history)

**WHERE tokens ARE stored:**
- ✅ Access Token: React state (memory) - no persistence
- ✅ Refresh Token: httpOnly cookie - automatic browser handling

## Complete Authentication Flow

### Step 1: Sign Up / Sign In

```
User submits credentials
         ↓
Backend validates credentials
         ↓
Backend generates:
  • Access Token (JWT, 15 min) → returned in response body
  • Refresh Token (raw hex) → hashed, stored in DB with TTL
         ↓
Backend sets httpOnly cookie:
  Set-Cookie: refresh_token=<raw-token>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh
         ↓
Response body:
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
         ↓
Frontend receives response
         ↓
Frontend stores in AuthContext (memory):
  accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  (Browser automatically stores httpOnly cookie)
         ↓
User is logged in ✅
```

### Step 2: API Request with Access Token

```
Frontend makes API call (e.g., GET /users/123)
         ↓
Axios request interceptor:
  1. Read accessToken from memory (AuthContext)
  2. Add to header: Authorization: Bearer <accessToken>
  3. Set withCredentials: true (auto-send httpOnly cookies)
         ↓
Request sent to backend:
  Headers:
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    Cookie: refresh_token=abc123... (automatic browser behavior)
         ↓
Backend validates:
  1. JWT signature is valid
  2. Token not expired (15 min)
  3. User exists and is active
         ↓
Request succeeds ✅
  Backend returns user data
```

### Step 3: Silent Token Refresh (401 Response)

```
Scenario: User left app open, 15 min pass, access token expires

Frontend makes API call (e.g., GET /users/123)
         ↓
Backend returns 401 Unauthorized
  (Access token expired)
         ↓
Axios response interceptor catches 401:
  1. Check if already refreshing (prevent duplicate requests)
  2. Set isRefreshing = true
  3. Call POST /auth/refresh
         ↓
Refresh Request:
  Headers:
    Authorization: (empty, no bearer token)
  Cookies:
    refresh_token=abc123... (auto-sent by browser)
         ↓
Backend RefreshGuard:
  1. Extract refresh_token from httpOnly cookie
  2. Find matching token hash in DB
  3. Verify not expired
  4. Delete old token (token rotation!)
  5. Generate new refresh_token
  6. Hash and save to DB
         ↓
Response:
  Set-Cookie: refresh_token=<NEW-raw-token>; HttpOnly; Secure; SameSite=Strict...
  Body: { "access_token": "<NEW-JWT>" }
         ↓
Frontend updates:
  1. Extract new accessToken from response
  2. Update AuthContext (memory)
  3. Update axios in-memory token
  4. Retry original request with new token
         ↓
Original request succeeds ✅
  User sees no interruption
```

### Step 4: Logout

```
User clicks logout button
         ↓
Frontend sends: POST /auth/logout
  Headers:
    Authorization: Bearer <accessToken>
  Cookies:
    refresh_token=abc123... (auto-sent)
         ↓
Backend JwtAuthGuard:
  1. Validate access token is valid
  2. Extract userId from token
         ↓
Backend logout handler:
  1. Get raw refresh_token from cookie
  2. Find and DELETE from DB
  3. Clear httpOnly cookie via Set-Cookie header
         ↓
Response:
  Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure; SameSite=Strict...
         ↓
Frontend:
  1. Clear accessToken from memory (AuthContext)
  2. Clear axios in-memory token
  3. Browser automatically clears httpOnly cookie
         ↓
User logged out ✅
  Cannot make authenticated requests
  Refresh token is deleted and cookie is cleared
```

## Attack Scenarios & Defenses

### Scenario 1: XSS Attack - Malicious Script on Page

```
Attacker injects: <script>fetch('/api/users').then(r => r.json()).then(data => sendToAttacker(data))</script>

What happens:
  ✅ Access Token in memory:  SAFE - Cannot be accessed by JavaScript
  ✅ Refresh Token in httpOnly cookie: SAFE - Cannot be accessed by JavaScript
  
  If script tries to make API call:
    → Axios interceptor CANNOT read accessToken (no authorization)
    → Request has NO Authorization header
    → Backend rejects with 401
  
  Result: Attack fails ❌
```

### Scenario 2: CSRF Attack - Form on Attacker Site

```
Attacker's website (attacker.com) has form:
  <form action="https://api.example.com/auth/logout" method="POST">
    <input type="hidden" name="...">
    <button>Click to claim prize!</button>
  </form>

What happens when user clicks:
  1. Form submits to api.example.com
  2. Browser checks: Is this a same-site request?
  3. Browser checks cookie: SameSite=Strict
  4. Result: refresh_token cookie is NOT sent
  5. Backend receives logout request WITHOUT refresh_token
  6. Request fails ❌

  OR if user clicks link on attacker.com going to /auth/refresh:
  1. GET request to api.example.com/auth/refresh
  2. Browser checks: SameSite=Strict on cookie
  3. Result: refresh_token is NOT sent ❌
  4. Invalid request fails ❌
```

### Scenario 3: Token Theft from Network

```
Attacker intercepts network traffic (not HTTPS)

What they can steal:
  ✅ PROTECTED: Refresh token - Only in httpOnly cookie
                              - Cannot steal via HTTPS
                              - Cannot steal from code
  
  ✅ PROTECTED: Access token in Authorization header
               - Only transmitted over HTTPS in production
               - Set-Cookie header has Secure flag (HTTPS only)
  
Solution: Secure flag ensures:
  - Cookies only sent over HTTPS
  - Cannot be intercepted over HTTP
```

### Scenario 4: Token Stored Insecurely (Before This Fix)

```
BEFORE: Access token in localStorage
  Vulnerable to: XSS attack reads localStorage
  
AFTER: Access token in memory only
  Protected: JavaScript cannot access memory
  Downside: Token lost on page refresh
  
SOLUTION: Refresh token in httpOnly cookie
  → Page refresh calls /auth/refresh
  → Gets new access token
  → No user re-login needed
```

## Security Checklist

### Backend ✅
- [x] httpOnly cookies set
- [x] Secure flag (production only)
- [x] SameSite=Strict
- [x] Path=/auth/refresh (restriction)
- [x] Helmet.js for security headers
- [x] CORS with specific origin
- [x] Token rotation on refresh
- [x] Hashed refresh tokens in DB
- [x] TTL index on refresh tokens
- [x] Input validation (class-validator)
- [x] Error messages don't leak user info

### Frontend ✅
- [x] Access token in memory only (no persistence)
- [x] withCredentials: true (send cookies)
- [x] Bearer token in Authorization header
- [x] Refresh token refresh on 401
- [x] Token queue during refresh (prevent race conditions)
- [x] Clear tokens on logout

## Vulnerability Matrix

| Attack Vector | Before | After | Risk |
|---|---|---|---|
| XSS reads localStorage | ❌ Vulnerable | ✅ Protected | CRITICAL |
| XSS reads httpOnly cookie | ✅ Protected | ✅ Protected | LOW |
| CSRF with cookies | ❌ Vulnerable | ✅ SameSite Strict | CRITICAL |
| Network sniffing (HTTP) | ❌ Vulnerable | ✅ Secure flag | CRITICAL |
| Token in URL | N/A | ✅ Protected (not in URL) | LOW |
| Token in error logs | N/A | ✅ Token hash only in logs | MEDIUM |

## Best Practices Applied

✅ **OWASP Top 10 2021**
- A01 Broken Access Control - Bearer token validation
- A02 Cryptographic Failures - HTTPS only, hashed tokens
- A04 Insecure Design - Token rotation, httpOnly cookies
- A07 Cross-Site Scripting - In-memory tokens
- A08 CSRF - SameSite attribute

✅ **OWASP Authentication Cheat Sheet**
- No password in JWT
- Token expiration (15 min)
- Refresh token rotation
- Logout invalidates token

✅ **OWASP Session Management Cheat Sheet**
- Secure cookies (HttpOnly, Secure, SameSite)
- Short-lived access tokens
- Token binding (same origin)

## Known Limitations & Mitigations

### Limitation: Token Lost on Hard Refresh
**Why:** Access token only in memory
```
User presses F5 or closes tab
  → Memory cleared
  → Access token lost
```

**Mitigation Implemented:**
```
On app load:
  1. AuthContext calls /auth/refresh
  2. Backend validates httpOnly refresh_token cookie
  3. Returns new access_token
  4. User stays logged in
```

### Limitation: No Offline Support
**Why:** Refresh requires server
```
No internet connection
  → Cannot refresh token
  → Cannot use app
```

**This is acceptable because:**
- Authentication must validate server-side
- Safer to require valid tokens
- Can implement offline queue if needed

## Future Enhancements (Optional)

1. **Device Fingerprinting**
   - Store device info with refresh token
   - Reject if device ID changes

2. **IP Whitelisting**
   - Optional: Store trusted IPs
   - Alert on new IP login

3. **Token Blocklist**
   - Redis cache of revoked tokens
   - Check on every request (adds latency)

4. **WebAuthn/2FA**
   - FIDO2 security keys
   - Biometric authentication

5. **Rate Limiting Per Token**
   - Detect brute force attacks
   - Already implemented in @nestjs/throttler

## Testing Security

```bash
# Test 1: Verify httpOnly cookies set
curl -i http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'
# Look for: Set-Cookie header with HttpOnly flag

# Test 2: Verify cookie not accessible from JavaScript
# Open browser DevTools → Console:
document.cookie  // Should show: ""
// (empty because httpOnly prevents access)

# Test 3: Verify CORS + cookies work
# Frontend at localhost:5173 can access backend
fetch('http://localhost:3000/auth/refresh', {
  method: 'POST',
  credentials: 'include'  // Include httpOnly cookies
})

# Test 4: Verify SameSite protection
# Try POST from different origin - cookie should not be sent

# Test 5: Verify token rotation
# Call /auth/refresh twice
# Each response should have DIFFERENT refresh_token

# Test 6: Verify old token deleted
# Use old refresh_token after refresh
# Should get 401 INVALID_REFRESH_TOKEN
```

## Conclusion

This implementation provides **enterprise-grade security** for authentication:

✅ **XSS Protected** - Tokens not in JavaScript-accessible storage
✅ **CSRF Protected** - SameSite=Strict prevents cross-origin attacks
✅ **Token Rotation** - Old tokens deleted, new tokens on every refresh
✅ **Secure Transport** - HTTPS only in production
✅ **Secure Storage** - httpOnly cookies + in-memory state
✅ **Token Expiration** - Short-lived access tokens + refresh rotation
✅ **No User Re-login** - Automatic silent refresh before expiration

The token strategy follows OWASP security guidelines and implements industry best practices.
