# Authentication Testing Guide

## Test Scenarios & Edge Cases

### Prerequisites
- Backend running: `http://localhost:3000`
- Frontend running: `http://localhost:5173`
- Browser DevTools open (F12)

---

## Test Suite 1: Sign Up Flow

### Scenario 1.1: Valid Sign Up
```
Input:
  Email: test@example.com
  Name: Test User
  Password: Test123!

Expected:
  ✅ Shows success notification
  ✅ Redirects to /dashboard
  ✅ No console errors
  ✅ Access token in memory
  ✅ Refresh token in httpOnly cookie
```

**Test Steps:**
1. Open http://localhost:5173/signup
2. Fill form with valid data
3. Click "Create account"
4. Watch for:
   - Loading spinner on button
   - Success notification
   - Redirect to dashboard
   - Check DevTools: No errors

---

### Scenario 1.2: Invalid Password Format
```
Input:
  Email: test2@example.com
  Name: Test User
  Password: short  (less than 8 chars)

Expected:
  ✅ Form validation error appears
  ✅ Button disabled (no submit)
  ❌ No API call made
```

**Test Steps:**
1. Go to /signup
2. Enter password "short"
3. Observe: Red error message under password field
4. Try to submit: Button should be disabled

---

### Scenario 1.3: Email Already Exists
```
Input:
  Email: test@example.com (already signed up)
  Name: Another Name
  Password: Test123!

Expected:
  ✅ Form submits
  ✅ Button shows loading spinner
  ✅ After 2-3 seconds: Error notification
  ✅ Stay on signup page
  ❌ Do NOT redirect
```

**Test Steps:**
1. Go to /signup
2. Use existing email
3. Wait for API response
4. Should see error: "Email already exists" or similar
5. Form should not clear (user can retry)

---

### Scenario 1.4: Network Error During Sign Up
```
Simulate: Disconnect internet or use DevTools throttling

Expected:
  ✅ Button shows loading
  ✅ After timeout: Error notification
  ✅ Stay on signup page
```

**Test Steps:**
1. Open DevTools Network tab
2. Throttle to "Offline"
3. Try to sign up
4. Should show error notification
5. Re-enable network, retry works

---

## Test Suite 2: Sign In Flow

### Scenario 2.1: Valid Sign In
```
Input:
  Email: test@example.com
  Password: Test123!

Expected:
  ✅ Shows success notification (optional but nice)
  ✅ Button shows loading spinner
  ✅ After 1-2 seconds: Redirects to /dashboard
  ✅ Dashboard shows user info
  ✅ No console errors
```

**Test Steps:**
1. Go to http://localhost:5173/login
2. Enter valid credentials
3. Click "Sign in"
4. Observe loading spinner
5. Wait for redirect
6. Dashboard should display with user info

---

### Scenario 2.2: Invalid Email Format
```
Input:
  Email: notanemail
  Password: Test123!

Expected:
  ❌ Form validation fails
  ✅ Error message shows: "Invalid email address"
```

**Test Steps:**
1. Enter "notanemail" in email field
2. Should see validation error immediately
3. Button should be disabled

---

### Scenario 2.3: Wrong Password
```
Input:
  Email: test@example.com
  Password: WrongPassword123!

Expected:
  ✅ API request sent
  ✅ Button shows loading
  ✅ After 1-2 seconds: Error notification
  ✅ Error message: "Invalid email or password"
  ✅ Stay on login page
  ✅ Form cleared or not? (your choice)
```

**Test Steps:**
1. Enter valid email but wrong password
2. Click "Sign in"
3. Wait for error response
4. Should NOT redirect
5. Form should allow retry

---

### Scenario 2.4: Non-existent Email
```
Input:
  Email: doesnotexist@example.com
  Password: Test123!

Expected:
  ✅ API request sent (no user enumeration)
  ✅ Error: "Invalid email or password" (generic)
  ✅ No mention of "user not found"
```

**Test Steps:**
1. Use non-existent email
2. API should return same error as wrong password
3. Cannot tell if email exists or not (security feature)

---

### Scenario 2.5: Remember Me Checkbox
```
Input:
  Email: test@example.com
  Password: Test123!
  Remember Me: CHECKED

Expected:
  ✅ Refresh token expires in 7 days
  ✅ User stays logged in after browser restart
```

**Test Steps:**
1. Check "Remember me"
2. Sign in
3. Close browser completely
4. Reopen app
5. User should still be logged in
6. Should see dashboard with user info

---

### Scenario 2.6: Remember Me NOT Checked
```
Input:
  Remember Me: UNCHECKED

Expected:
  ✅ Refresh token expires in 24 hours
  ✅ Close browser
  ✅ User logged out (no cookie persistence)
```

**Test Steps:**
1. Leave "Remember me" unchecked
2. Sign in
3. Close browser
4. Reopen app
5. Should be redirected to login
6. Fresh session required

---

## Test Suite 3: Dashboard / Authenticated State

### Scenario 3.1: Direct Access to Dashboard (Authenticated)
```
Precondition: User is already logged in

Expected:
  ✅ Dashboard loads immediately
  ✅ Shows user profile info
  ✅ Logout button is clickable
```

**Test Steps:**
1. Sign in successfully
2. Go to /dashboard
3. Should see user info
4. Logout button should work

---

### Scenario 3.2: Direct Access to Dashboard (Not Authenticated)
```
Precondition: User is NOT logged in (new session)

Expected:
  ✅ Redirect to /login
  ❌ Cannot access /dashboard without auth
```

**Test Steps:**
1. Clear browser cookies and storage
2. Go to http://localhost:5173/dashboard
3. Should redirect to /login
4. Cannot bypass auth

---

### Scenario 3.3: Page Refresh While Authenticated
```
Precondition: User logged in and on /dashboard

Expected:
  ✅ Page refresh works
  ✅ Silent refresh using refresh_token cookie
  ✅ User stays on page
  ✅ User info still displays
  ✅ No login required
```

**Test Steps:**
1. Sign in and go to dashboard
2. Press F5 (refresh page)
3. Page should NOT redirect to login
4. User info should still show
5. No console errors

---

## Test Suite 4: Token Refresh Flow

### Scenario 4.1: Access Token Expiration (Silent Refresh)
```
Precondition: Access token will expire (wait or modify exp in token)

Expected:
  ✅ User makes API call
  ✅ Gets 401 response (token expired)
  ✅ Axios interceptor automatically calls /auth/refresh
  ✅ Gets new access token
  ✅ Original API call retried with new token
  ✅ User sees NO interruption
```

**Test Steps:**
1. Sign in
2. Go to console, note the access_token expiration time
3. Make request to /api/users/:id (via DevTools Network)
4. Wait 15 minutes (or mock the time)
5. Make another request
6. Should automatically refresh token
7. No user interaction needed

---

### Scenario 4.2: Refresh Token Expired
```
Precondition: Refresh token cookie expired (>7 days old or invalid)

Expected:
  ✅ Silent refresh fails
  ✅ User redirected to /login
  ✅ Must log in again
```

**Test Steps:**
1. Wait for refresh token to expire (7 days)
2. Try to access dashboard
3. Should redirect to login

---

## Test Suite 5: Logout Flow

### Scenario 5.1: Normal Logout
```
Precondition: User logged in

Expected:
  ✅ Click logout button
  ✅ Button shows loading spinner
  ✅ After 1-2 seconds: Redirect to /login
  ✅ Refresh token deleted from DB
  ✅ httpOnly cookie cleared
```

**Test Steps:**
1. Sign in
2. Go to dashboard
3. Click "Logout" button
4. Observe loading spinner
5. Redirect to login
6. Try to go to /dashboard: Should redirect to /login

---

### Scenario 5.2: Cannot Refresh After Logout
```
Precondition: User just logged out

Expected:
  ❌ Cannot call /auth/refresh
  ❌ Token deleted from DB
  ❌ Must log in again
```

**Test Steps:**
1. Sign in
2. Logout
3. Try to access dashboard
4. Should redirect to login
5. Refresh token is no longer valid

---

### Scenario 5.3: Logout with Network Error
```
Precondition: Network fails during logout

Expected:
  ✅ Frontend clears tokens anyway (best-effort)
  ✅ User redirected to login
  ✅ Backend might still have token (cleanup scheduled)
```

**Test Steps:**
1. Disable network
2. Click logout
3. Should still redirect
4. Re-enable network
5. Frontend is logged out (backend cleanup happens later)

---

## Test Suite 6: Edge Cases & Corner Cases

### Scenario 6.1: Rapid Multiple Login Attempts
```
Precondition: Click "Sign in" button 5 times rapidly

Expected:
  ✅ First request succeeds
  ✅ Subsequent requests cancelled
  ❌ Not 5 logins created
```

**Test Steps:**
1. Click "Sign in" multiple times
2. Button should remain in loading state
3. Only one request should complete
4. Check DB: Only one token created

---

### Scenario 6.2: Sign In > Sign Up Link
```
Precondition: On login page

Expected:
  ✅ Click "Sign up" link
  ✅ Navigate to /signup
  ✅ Form clears
```

**Test Steps:**
1. Go to /login
2. Click "Sign up" link
3. Should go to /signup
4. Form should be empty

---

### Scenario 6.3: Sign Up > Sign In Link
```
Precondition: On signup page

Expected:
  ✅ Click "Sign in" link
  ✅ Navigate to /login
  ✅ Form clears
```

**Test Steps:**
1. Go to /signup
2. Click "Sign in" link
3. Should go to /login

---

### Scenario 6.4: Form Submission Without Filling
```
Precondition: Empty form

Expected:
  ✅ Validation errors show for all fields
  ❌ Form doesn't submit
```

**Test Steps:**
1. Click submit without filling form
2. Should see: "Required" or similar errors
3. Button disabled

---

### Scenario 6.5: Paste Credentials (Security)
```
Precondition: Credentials in clipboard

Expected:
  ✅ Can paste into form fields
  ✅ Works like normal input
```

**Test Steps:**
1. Copy credentials
2. Right-click, paste into fields
3. Should work fine

---

### Scenario 6.6: Browser Back Button After Login
```
Precondition: Just logged in and on dashboard

Expected:
  ✅ Press browser back
  ✅ Goes to /login
  ✅ But user is still authenticated
  ✅ Can go forward to /dashboard
```

**Test Steps:**
1. Sign in
2. Press browser back button
3. Goes to login page
4. Press forward button
5. Goes back to dashboard
6. Still authenticated

---

### Scenario 6.7: Same Credentials, Different Case Email
```
Input:
  First signup: Test@Example.com
  Second signin: test@example.com

Expected:
  ✅ Treated as same user (case-insensitive)
  ✅ Sign in succeeds
```

**Test Steps:**
1. Sign up with: Test@Example.com
2. Log out
3. Sign in with: test@example.com
4. Should succeed (emails are case-insensitive)

---

### Scenario 6.8: Special Characters in Name
```
Input:
  Name: José María O'Brien-Smith

Expected:
  ✅ Accepted (name field allows special chars)
  ✅ Displayed correctly on dashboard
```

**Test Steps:**
1. Sign up with special char name
2. Dashboard should display it correctly
3. Check DB: Stored correctly

---

## Test Suite 7: Browser DevTools Debugging

### Check Console Logs
```javascript
// DevTools Console should show:

// On login success:
console.log('Login successful, token set');

// On error:
console.error('Login failed:', error);

// No red errors for successful operations
```

**Test Steps:**
1. Open DevTools (F12)
2. Go to Console tab
3. Sign in
4. Should see info logs, no errors

---

### Check Network Requests
```
Expected requests:
POST /auth/signin → 200 OK
POST /auth/refresh → 200 OK (on page load)
GET /users/:id → 200 OK (fetch profile)
POST /auth/logout → 200 OK
```

**Test Steps:**
1. Open Network tab
2. Sign in
3. Check requests:
   - /signin should return { access_token }
   - Response should NOT contain refresh_token
   - Cookies tab should show refresh_token cookie
4. Go to dashboard
5. Check requests for /users/:id
6. Logout
7. Verify /logout succeeds

---

### Check Cookies
```
Expected:
- refresh_token: present, HttpOnly, Secure, SameSite=Strict
- NO access_token in cookies
- NO tokens in localStorage
```

**Test Steps:**
1. Sign in
2. Open DevTools → Application → Cookies
3. Verify refresh_token exists
4. Verify HttpOnly flag is set
5. Verify no access_token cookie

---

### Check Storage
```
Expected:
- localStorage: empty (no tokens)
- sessionStorage: empty (no tokens)
- Cookies: refresh_token only
```

**Test Steps:**
1. Open DevTools → Application → Storage
2. Check localStorage: Should be empty
3. Check sessionStorage: Should be empty
4. Check cookies: refresh_token only

---

## Summary Checklist

After running all tests, verify:

- [ ] Sign up works with valid data
- [ ] Sign up rejects invalid password
- [ ] Sign up prevents duplicate emails
- [ ] Sign in works with valid credentials
- [ ] Sign in rejects invalid credentials
- [ ] Remember me extends token to 7 days
- [ ] Logout clears tokens
- [ ] Page refresh maintains session
- [ ] Dashboard redirects if not authenticated
- [ ] Logout redirects to login
- [ ] No tokens in localStorage
- [ ] refresh_token in httpOnly cookie
- [ ] No console errors
- [ ] All API requests succeed
- [ ] All edge cases handled

## Issues Found During Testing?

Please report:
1. What you did (exact steps)
2. What you expected
3. What actually happened
4. Browser console errors
5. Network requests (screenshot)
6. Browser version
