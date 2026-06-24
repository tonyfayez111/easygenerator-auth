# ADR-001: Refresh Token Strategy - Raw Opaque Tokens vs JWT

**Status:** ✅ ACCEPTED

**Date:** 2026-06-23


---

## Context

The authentication system requires a refresh token mechanism to allow users to obtain new access tokens without re-entering credentials. Two primary approaches exist:

1. **Raw Opaque Tokens** (Stateful - stored in DB)
2. **JWT Tokens** (Stateless - self-contained)

This decision affects:
- Security posture against token compromise
- Ability to revoke/logout users
- System scalability and complexity
- Compliance with security standards

---

## Decision

**We will use Raw Opaque Tokens for refresh tokens.**

Refresh tokens will be:
- Random 64-byte hex strings (cryptographically random)
- Hashed with SHA-256 before storage
- Stored in MongoDB with userId, hash, and expiration
- Rotated on every use (old token deleted, new token issued)
- Deleted on logout (true logout)
- httpOnly cookies (XSS protection)
- SameSite=Strict (CSRF protection)

---

## Rationale

### 1. Security: Immediate Revocation ✅

**Problem with JWT:**
- Refresh tokens expire after 7 days
- User clicks logout but token remains valid
- Attacker with stolen token can refresh for 7 days
- No way to force logout

**Solution with Opaque Tokens:**
```javascript
// On logout:
await refreshTokenModel.deleteOne({ _id: tokenId });
// Token immediately invalid
// Attacker cannot refresh anymore
```

**Impact:** Reduces unauthorized access window from 7 days to 0 days.

### 2. Security: Token Rotation (Breach Containment)

**Problem with JWT:**
- If token is stolen on Day 3 of 7-day validity
- Attacker has 4 days to use the token
- No way to invalidate without JWT secret rotation

**Solution with Opaque Tokens:**
```
Day 1: Token issued
Day 3: User refreshes
  ✅ Old token deleted from DB
  ✅ Attacker's stolen token now invalid
  ✅ Exposure limited to 2 days, not 7
Day 3: Attacker tries to use old token
  ❌ Token not found in DB
  ❌ Request rejected
```

**Impact:** Token rotation reduces potential exposure from 7 days to hours/minutes.

### 3. Security: True Session Management

**Problem with JWT:**
- Tokens are stateless, cannot be managed per-session
- Cannot logout from individual devices
- Cannot detect suspicious activity per-token

**Solution with Opaque Tokens:**
```javascript
// Each token is tracked:
{
  _id: ObjectId,           // Unique token identifier
  userId: ObjectId,        // User who owns this token
  tokenHash: string,       // SHA-256 hash of the token
  deviceInfo: {            // Optional: device fingerprint
    userAgent: string,
    ipAddress: string
  },
  createdAt: Date,
  expiresAt: Date,
  lastUsedAt: Date         // Track usage patterns
}

// Can:
// - Logout from single device (delete one token)
// - Detect compromised token (unusual IP/device)
// - Force logout across all sessions (delete all tokens)
// - Audit refresh history
```

**Impact:** Enables true session management and security monitoring.

### 4. Security: OWASP Compliance

**OWASP Session Management Cheat Sheet (2023):**

> "Refresh tokens should be issued with the ability to be revoked and rotated on each use."

**JWT Approach:**
- ❌ Cannot be revoked (stateless)
- ❌ Cannot be rotated (same token valid for 7 days)
- ❌ Non-compliant

**Opaque Token Approach:**
- ✅ Can be revoked (delete from DB)
- ✅ Rotated on each use (old deleted, new issued)
- ✅ OWASP compliant

**References:**
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

### 5. Attack Scenario Analysis

**Scenario: Attacker steals refresh token**

```
Timeline with JWT Refresh Token (7-day expiration):
┌─────────────────────────────────────────────────────┐
│ Day 1     Day 2     Day 3     Day 4     Day 5     Day 7
│ [STOLEN]──────────── ATTACKER HAS ACCESS ──────────[EXPIRED]
│ User calls logout, but token still valid!
└─────────────────────────────────────────────────────┘
Risk: 7 full days of unauthorized access


Timeline with Opaque Token (with rotation):
┌──────────────────────────────────────────────────────┐
│ Day 1         Day 1.5       Day 1.75      Day 2
│ [STOLEN]──[USER REFRESHES]─[ATTACKER TRIES]─[LOGOUT]
│           └─ Old token       └─ DENIED        └─ All tokens
│             deleted             (not in DB)     deleted
│             New token
│             issued
└──────────────────────────────────────────────────────┘
Risk: Hours, not days. Reduced from 7 days to ~12 hours.
```

### 6. Performance Trade-off Analysis

**Concern:** "DB lookup on every refresh will be slow"

**Analysis:**
- MongoDB indexed query on `userId` + `tokenHash`: <5ms
- Refresh endpoint already makes 2+ DB queries
- One additional indexed query is negligible
- Cost: <5ms latency | Benefit: Security++

**Decision:** Accept minimal latency cost for security.

### 7. Scalability Consideration

**Myth:** "Opaque tokens don't scale because they need DB lookups"

**Reality:**
- DB lookups scale well with proper indexing
- Already storing refresh tokens in DB (this ADR)
- Modern distributed databases handle millions of queries/second
- Refresh is not on critical path (only every 15 minutes)

**Database Optimization:**
```javascript
// Create indexes for performance
db.refresh_tokens.createIndex({ userId: 1, tokenHash: 1 });
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

---

## Consequences

### Positive ✅

1. **Security Enhanced**
   - True logout (immediate revocation)
   - Token rotation (breach containment)
   - Session management per-device
   - OWASP compliant

2. **Compliance**
   - Meets OWASP requirements
   - Aligns with industry best practices
   - Audit-friendly (all tokens logged)

3. **Features Enabled**
   - Device management ("logout from other devices")
   - Suspicious activity detection
   - Per-device security policies
   - Token refresh history

### Negative ⚠️

1. **Database Dependency**
   - Every refresh requires DB query
   - Database unavailability = cannot refresh
   - Adds ~5ms latency

2. **Storage**
   - Tokens stored in DB (instead of stateless)
   - Must manage TTL and cleanup
   - Minimal storage impact

3. **Complexity**
   - More code than JWT validation
   - Needs DB schema + indexes
   - Token rotation logic

---

## Alternatives Considered

### Alternative 1: JWT Refresh Tokens (Rejected ❌)

**Approach:**
- Refresh token is a JWT signed with JWT_SECRET
- Contains: `{ sub: userId, type: 'refresh', iat, exp }`
- Validated with JWT.verify() (no DB lookup)

**Advantages:**
- Simpler code (no DB schema)
- Stateless (scales infinitely)
- No database queries

**Disadvantages:**
- ❌ Cannot revoke tokens (token valid until expiration)
- ❌ Cannot truly logout (token still works)
- ❌ Cannot rotate tokens
- ❌ Token compromise = 7 days of unauthorized access
- ❌ No device/session management
- ❌ OWASP non-compliant
- ❌ Cannot detect compromised tokens

**Decision:** Rejected due to security concerns.

### Alternative 2: JWT + Blocklist (Rejected ❌)

**Approach:**
- JWT refresh tokens like Alternative 1
- Maintain blocklist of revoked tokens in Redis
- Check blocklist on every refresh

**Advantages:**
- Can revoke tokens (via blocklist)
- Mostly stateless (with Redis exception)

**Disadvantages:**
- ❌ Still need DB/Redis (loses stateless advantage)
- ❌ More complex than opaque tokens
- ❌ Blocklist grows indefinitely (until token expiration)
- ❌ Still cannot distinguish between devices
- ❌ Requires Redis infrastructure
- ❌ Race conditions with concurrent refreshes

**Decision:** Rejected. More complex without security benefit.

### Alternative 3: Hybrid (Access JWT + Opaque Refresh) (Accepted ✅)

**Approach:**
- Access token: JWT (15 min, stateless, fast)
- Refresh token: Opaque (7 days, stateful, revocable)

**Advantages:**
- Access token is fast (no DB lookup)
- Refresh token is secure (revocable)
- Best of both worlds

**Status:** This is our current approach and is the industry standard.

---

## Implementation Details

### Token Generation

```typescript
// Refresh token is a random 64-byte hex string
private generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Not a JWT, just random bytes
// Benefits: Cannot be forged, completely opaque
```

### Storage

```typescript
// MongoDB schema
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: string,        // SHA-256(rawToken)
  expiresAt: Date,
  createdAt: Date,
  lastUsedAt: Date,
  
  // Optional: security features
  deviceInfo: {
    userAgent: string,
    ipAddress: string,
    deviceId: string
  }
}

// Indexes
db.refresh_tokens.createIndex({ userId: 1, tokenHash: 1 }, { unique: true });
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

### Refresh Flow

```
1. Client sends POST /auth/refresh
   • Cookie sent automatically by browser
   • Contains raw refresh_token

2. Backend RefreshGuard:
   • Extracts raw token from httpOnly cookie
   • Validates it exists
   • Passes to controller

3. Controller/Service:
   • Hash the token: tokenHash = SHA256(rawToken)
   • Query DB: SELECT * WHERE tokenHash = ? AND userId = ?
   • Validate token exists and not expired
   • DELETE old token (rotation!)
   • Generate new token
   • Hash and save new token
   • Return new access_token

4. Client:
   • Stores access_token in memory
   • Browser stores httpOnly cookie
```

---

## Security Properties Achieved

✅ **XSS Protection**
- Access token: in-memory only
- Refresh token: httpOnly cookie (JavaScript cannot access)

✅ **CSRF Protection**
- httpOnly cookie with SameSite=Strict
- Cannot be sent cross-origin

✅ **Token Compromise**
- Old tokens deleted on refresh
- Leaked tokens have limited lifetime
- Can be revoked immediately

✅ **Logout**
- Token deleted from DB
- User cannot refresh anymore
- True session termination

✅ **Replay Attack Prevention**
- Each token is unique
- Old tokens deleted after use
- Can detect token reuse from different IPs

✅ **Device Management**
- Can track per-device tokens
- Logout from single device possible
- Detect suspicious login patterns

---

## Testing & Verification

### Unit Tests

```typescript
// Verify token generation is random
// Verify token hashing is deterministic
// Verify token rotation deletes old token
// Verify expired tokens are rejected
// Verify logout deletes tokens
```

### Integration Tests

```bash
# Test 1: Successful refresh
POST /auth/signin → Get token
POST /auth/refresh → Get new token
Verify old token invalid

# Test 2: Logout revocation
POST /auth/signin → Get token
POST /auth/logout → Delete token
POST /auth/refresh → 401 INVALID_REFRESH_TOKEN

# Test 3: Token rotation
POST /auth/refresh (iteration 1) → Token A
POST /auth/refresh (iteration 2) → Token B (A deleted)
Try Token A → 401

# Test 4: Expiration cleanup
Wait for TTL → Token automatically deleted
POST /auth/refresh with expired token → 401
```

### Security Tests

```bash
# Test: Verify httpOnly cookie
curl -i http://localhost:3000/auth/signin | grep "Set-Cookie"
# Should see: HttpOnly flag

# Test: Verify SameSite
# Should see: SameSite=Strict

# Test: Verify token not in URL
# Should NOT appear in browser history/logs

# Test: Verify token rotation
# Each refresh should have different token_hash in DB
```

---

## Monitoring & Maintenance

### Metrics to Track

```javascript
// Monitor refresh endpoint
- Refresh success rate
- Refresh latency (should be <50ms)
- Token age distribution
- Tokens per user (detect duplicates)
- Geographic distribution (detect anomalies)
```

### Maintenance Tasks

```javascript
// TTL index auto-cleanup
// Runs daily: deleted expired tokens
// No manual cleanup needed

// Monitor for
- Unusually high token generation (possible attack)
- Tokens from suspicious IPs
- Users with 100+ simultaneous tokens (unusual)
```

---

## References

1. **OWASP Session Management Cheat Sheet**
   - https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
   - Section: "Token Storage"
   - Section: "Session Timeout"

2. **OWASP Authentication Cheat Sheet**
   - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
   - Section: "Password Storage"
   - Section: "Implement Proper User Logout"

3. **OWASP JWT Security Cheat Sheet**
   - https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html

4. **OAuth 2.0 Refresh Token Specification**
   - https://tools.ietf.org/html/rfc6749#section-6

5. **Auth0 Token Storage Best Practices**
   - Refresh tokens should be opaque and revocable

6. **NIST SP 800-63B (Digital Identity Guidelines)**
   - Section 5.2: Authentication
   - Recommends revocable refresh tokens

---

## Related ADRs

- ADR-002: Access Token Strategy (JWT with 15-min expiration)
- ADR-003: Cookie Security Headers (HttpOnly, Secure, SameSite)

---

## Questions & Answers

**Q: Why not just use JWT for simplicity?**
A: JWT cannot be revoked, making true logout impossible. With opaque tokens, we achieve both simplicity AND security.

**Q: Will DB lookups on every refresh be slow?**
A: No. MongoDB indexed queries: <5ms. Negligible impact since refresh happens infrequently (every 15 min).

**Q: What if the database goes down?**
A: Users cannot refresh tokens. They must login again. This is acceptable - authentication must be reliable.

**Q: Can we add token blocklist like OAuth providers do?**
A: Yes, if needed. But opaque tokens with DB storage are simpler and more secure than JWT + blocklist.

**Q: How does this scale to millions of users?**
A: Very well. Each user has 1-2 tokens at a time. Total DB size: minimal. Indexed queries scale to millions.

---

## Sign-off

- **Proposed by:** Security Team
- **Approved by:** Backend Architecture
- **Implementation by:** Backend Team
- **Implementation Date:** 2026-06-23
- **Review Date:** 2027-06-23 (Annual security review)

---

## Changelog

| Date | Status | Notes |
|---|---|---|
| 2026-06-23 | ACCEPTED | Initial ADR created, opaque tokens chosen over JWT |
| | | Rationale: Security (revocation, rotation) > Simplicity |
