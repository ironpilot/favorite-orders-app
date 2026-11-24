# Account Creation and Sign Up

## Summary
A simple, phone-friendly account experience so people can sign up, verify their email, sign in again, and manage their account, keeping their favorite orders under their own account. After signing up and verifying, the user lands on the restaurant list.

## Goals
- Let a new user get started with the app quickly and with little effort.
- Tie each user's favorite orders to their own account so they stay private to the owner until shared.
- Give the user a clear path from sign-up and verification into the app (the restaurant list).
- Let returning users sign in, sign out, recover access and manage their account.
- Provide a consistent experience on phones first, with acceptable layout on tablet and desktop, across iOS, Android, and a PWA.

## Requirements

### Functional Requirements
1. **Open the app:** A user who is not signed in and opens the app on first startup sees only sign-in or account creation (sign-up). Nothing else in the app is reachable until authentication succeeds (see FR-A1).
2. **Create an account:** The user signs up from a simple screen by providing name, email, phone and a password.
3. **Unique details:** Email and phone must each be unique to one account. If either is already used, the app shows a generic error message that does not reveal which detail is taken or whether an account exists.
4. **Input validation:** Missing or invalid sign-up information is rejected with clear messages. The password must be at least 8 characters and contain letters and numbers.
5. **Email verification:** The user must verify their email before using the app. The phone number is collected but not verified.
6. **Verification failures:** If the code or link expires or does not arrive, the user can request a new one. A code or link is valid for 15 minutes and the expiry time is clearly shown. Resending is limited to 1 per minute and 5 per hour, and a new code or link invalidates the previous one.
7. **Landing after sign-up:** After verifying, the user lands on the restaurant list (which shows an empty state pointing them to add their first order).
8. **Sign in:** A returning user signs in with email and password. An unverified user is directed to complete verification.
9. **Sign out:** The user can sign out of the app, including while offline. Signing out clears the stored tokens and revokes the refresh token on the server when a connection is available.
10. **Forgot password / recovery:** The user can regain access if they forget their password. A time-limited reset link is emailed to the account's verified email.
11. **Edit profile:** The user can change their name, email, phone and password. Changing the email requires re-verification; until the new email is verified, the user keeps using the app and the old email stays active. Friend links stay attached to the account after changes. Changed email and phone must remain unique.
12. **Delete account:** The user can delete their account after confirmation. All their data is removed, including orders, restaurants, shares and friendships.
13. **Account ownership:** Orders and restaurants the user creates are associated with their account and are private to them until shared.
14. **Identifiers usable by friends:** The account's email and phone are what other users use to find them when sending friend requests (search is by email or phone, not by name).
15. **Signed-in access:** No application functionality or API call is usable without successful authentication, including opening share links (share links are usable by anyone signed in; users without the app are sent to the app store or PWA). A link opened while signed out is remembered through login and resumes after login or token refresh.
16. **Share link sign-up:** If a new user signs up from a share link, the link is remembered and opens once they have verified their email and signed in.
17. **Offline behavior:** Sign-up and sign-in require a connection and are not allowed offline. A user with no session who is offline sees the login screen with a message that a connection is needed.
18. **Offline account actions:** Sign-out works offline and clears the tokens. Recovery, edit profile and delete account are disabled while offline, with the same connection-needed message.
19. **Sign-up screen:** The screens are simple, phone-friendly, and built with Ionic components.

#### Authentication Gate, Sessions and Offline Use
- **FR-A1 Auth gate:** On first startup the app shows only login or registration. No other route or API call is usable until authenticated. Share links also require authentication and are remembered through login.
- **FR-A2 Token lifetimes:** The access token lasts 1 hour. The refresh token lasts 2 weeks.
- **FR-A3 Session persistence:** On app load a stored session is restored. If the access token is valid, the user goes straight to the app.
- **FR-A4 Silent refresh:** If the access token has expired, the app silently refreshes with the refresh token. On success it continues and stores the new tokens.
- **FR-A5 Expired session:** If both tokens are expired or the refresh is rejected, the session is cleared and login is shown.
- **FR-A6 Offline banner:** A signed-in user who goes offline sees a persistent banner, "Operating offline", and the app keeps working with cached data.
- **FR-A7 Reconnect:** When the connection returns, the app checks token expiry and acts as on a resume from pause: it refreshes if needed, shows login if both tokens have expired, and otherwise hides the banner.
- **FR-A8 Connection needed:** Sign-up and sign-in still need a connection. An offline user with no session sees the login screen with a connection-needed message. Sign-out works offline and clears the tokens.
- **FR-A9 Resume:** App resume from background applies the same expiry check as startup.

### Constraints and Assumptions
- Mobile-first, with acceptable layout on tablet and desktop.
- Must work on iOS, Android, and a PWA.
- Offline support covers viewing cached saved and shared orders only; a signed-in user keeps using cached data offline, with the "Operating offline" banner shown.
- Out of scope: social login, MFA, multi-device session management.
- Sign-up, sign-in, recovery, edit profile and delete account need a connection and are disabled offline with a message. Sign-out remains available offline.
- Email verification gates access; phone verification is not required.

### Dependencies
- **Restaurant List:** the destination users land on after sign-up and sign-in.
- **Friends:** relies on accounts being findable by email or phone, and on friendships being removed when an account is deleted.
- **Share an Order / share links:** opening a link requires being signed in, so a new user may sign up and verify as part of resuming a link. Deleting an account removes the user's shares.
- **Manage Favorite Orders:** orders and restaurants owned by the user are removed when the account is deleted.

### Edge Cases
- A new user with no orders lands on the empty restaurant list.
- A user opens a share link without having an account or the app, signs up, verifies, and then the link resumes.
- The user tries to sign up or sign in while offline (not allowed, message shown).
- The user signs up with an email or phone already used by an existing account (generic error).
- Invalid or missing sign-up information is entered.
- The verification code or link expires or never arrives (resend, rate-limited).
- The user requests too many verification resends.
- An unverified user tries to sign in or use the app.
- The user changes their email and has not yet re-verified the new one.
- The user changes their email or phone to one already used by another account.
- The user deletes their account while friends hold or view their shared orders.
- A refresh token is reused or rotated out: the refresh is rejected and login is shown.
- The access token expires while offline: the user keeps using cached data and is only challenged on reconnect.
- A 401 mid-session triggers one refresh attempt, then login.
- Concurrent requests share a single refresh call.
- A refresh fails because the device is offline: defer it until reconnect and do not sign the user out.

### Decisions
- Sign-up collects name, email, phone and password.
- Email verification is required before use; phone is not verified.
- Sign-in uses email and password.
- Duplicate email or phone shows a generic error.
- Sign-up, sign-in, recovery, edit profile and delete account are blocked offline; sign-out works offline.
- Password: minimum 8 characters, letters and numbers.
- Verification code or link valid 15 minutes; resend 1 per minute, 5 per hour.
- Recovery uses an emailed reset link.
- After an email change, the user keeps using the app with the old email until the new one is verified.
- Account deletion removes all user data.
- Access token lasts 1 hour; refresh token is opaque, lasts 2 weeks, is stored hashed on the server, and is rotated on each use.
- Add `POST /auth/refresh`; revoke the refresh token on sign-out.
- The client stores both tokens with their expiry times; a central auth service owns the states `unauthenticated | authenticated | offline`.
- Connectivity uses `navigator.onLine` plus `online`/`offline` events, confirmed by a failed request; an Ionic offline banner shows at the app shell.

### Open Questions
None at this time.

## Implementation Steps

Each step is a usable increment that builds on the previous one. Each step has a **Status** line: `Complete`, `Partial` (with what is done and what remains), or `Not started`. Status last reviewed 2026-11-24 against the code in `client/` and `server/`.

| Step | Status |
|------|--------|
| 1. Sign-up and sign-in basics | Complete |
| 2. Email verification | Complete |
| 3. Sign out and forgot password | Complete |
| 4. Edit profile | Complete |
| 5. Delete account | Not started |
| 6. Share link sign-up and signed-in access | Not started |
| 7. Offline behavior | Not started |
| 8. Server access and refresh tokens | Not started |
| 9. Client session storage, restore and refresh | Not started |
| 10. Connectivity, offline banner and re-validation | Not started |

### Step 1: Sign-up and sign-in basics
**Covers:** FR1, FR2, FR3, FR4, FR8, FR13, FR19

**Details:**
- Account model with unique email and unique phone; duplicates return one generic error.
- Validation with clear messages; password at least 8 characters with letters and numbers.
- Simple Ionic sign-up and sign-in screens; the app is gated behind sign-in.
- After sign-in the user lands on the restaurant list (see `feature-restaurant-list.md`). Orders and restaurants belong to the signed-in account (see `feature-manage-orders.md`).

**Status:** Complete. Sign-up collects name, email, phone and password; email and phone are unique (phone normalized), duplicates return one generic error, password needs 8+ characters with letters and numbers, validation messages on client and server; auth-gated routes, redirect to the restaurant list, account-owned data.

**Tests:**
- Sign-up with valid details creates an account and lands on the restaurant list.
- Duplicate email or phone shows the same generic error.
- Missing or invalid fields and weak passwords are rejected with messages.
- Sign-in with valid and invalid credentials.
- Signed-out users are sent to sign-in.

### Step 2: Email verification
**Covers:** FR5, FR6, FR7

**Details:**
- Send a code or link on sign-up, valid 15 minutes, with the expiry shown.
- Resend limited to 1 per minute and 5 per hour; a new code or link invalidates the previous one.
- Unverified users (including on sign-in) are redirected to verification; after verifying they land on the restaurant list.

**Status:** Complete. A 6-digit code (stored hashed) is emailed on sign-up, valid 15 minutes, with the expiry shown on the Ionic verification screen; resend is limited to 1 per minute and 5 per hour and invalidates earlier codes; the server answers 403 to unverified users outside the auth endpoints and the router keeps them on `/verify-email`; verifying lands on the restaurant list. Accounts that existed before this step are treated as verified.

**Tests:**
- Valid code verifies the account and lands on the restaurant list.
- Expired and invalidated codes are rejected.
- Resend limits are enforced.
- Unverified users cannot reach the app.

### Step 3: Sign out and forgot password
**Covers:** FR9, FR10

**Details:**
- Sign out clears the session and revokes the refresh token on the server (when online; offline sign-out clears local tokens only).
- Forgot password emails a time-limited reset link to the verified email; the link sets a new password.

**Status:** Complete. Sign-out on the Profile screen revokes the server session and its refresh token and clears both local tokens (offline it clears the local tokens only); sign-in and sign-up now also issue an opaque 14-day refresh token, stored hashed in `refresh_tokens`; forgot password always gives the same neutral answer and emails a single-use reset link (token stored hashed, valid 30 minutes, a new link invalidates the old one) to verified accounts only; resetting signs the account out everywhere and revokes all refresh tokens. Refresh-token rotation, reuse detection and `POST /auth/refresh` remain part of Step 8.

**Tests:**
- Sign-out returns to sign-in and protected routes are blocked.
- The refresh token is rejected after sign-out.
- Reset link works once and fails after expiry.
- Unknown email gives no account-existence hint.

### Step 4: Edit profile
**Covers:** FR11, FR14

**Details:**
- Change name, email, phone and password, keeping email and phone unique.
- Changing the email requires re-verification; the old email stays active until then.
- Friend links stay attached; email and phone remain the identifiers friends search by.

**Status:** Complete. `PATCH /api/auth/me` updates name and phone (normalized) and changes the password when the current one is given (other sessions and their refresh tokens are revoked); duplicate email or phone gets the same generic error. A new email gets a 6-digit code (valid 15 minutes, resend limited to 1 per minute and 5 per hour, cancellable) through `/api/auth/email-change/verify`, `/resend` and `DELETE /api/auth/email-change`; the old email stays active for sign-in until the new one is confirmed. The Profile screen shows the edit form and the pending email change. Friendships reference the account id, so they stay attached, and friend search uses the current email and phone.

**Tests:**
- Each field can be updated.
- Duplicate email or phone is rejected.
- Old email stays active until the new one is verified.

### Step 5: Delete account
**Covers:** FR12

**Details:**
- Confirmation, then removal of the account and all orders, restaurants, shares and friendships.

**Status:** Not started.

**Tests:**
- Deletion requires confirmation.
- All user data is removed and friends no longer see shared orders.
- The user cannot sign in afterwards.

### Step 6: Share link sign-up and signed-in access
**Covers:** FR15, FR16

**Details:**
- Opening a share link requires sign-in. The link is remembered through sign-up and verification, then opened (see the sharing feature docs).

**Status:** Not started.

**Tests:**
- Signed-out user opening a link is sent to sign-in and returns to the link.
- New user signs up, verifies, and the link opens.

### Step 7: Offline behavior
**Covers:** FR17, FR18

**Details:**
- Sign-up, sign-in, recovery, edit profile and delete account are disabled offline with a connection-needed message, shown alongside the "Operating offline" banner (Step 10).
- Sign-out works offline.

**Status:** Not started.

**Tests:**
- Each blocked action shows the message offline.
- Sign-out succeeds offline.

### Step 8: Server access and refresh tokens
**Covers:** FR-A2, FR-A4, FR-A5

**Details:**
- Issue a 1-hour access token and an opaque 14-day refresh token on sign-in and sign-up.
- Store the refresh token hashed; rotate it on each use and reject reuse.
- Add `POST /auth/refresh`; revoke the refresh token on sign-out.
- Reject every API call without a valid access token with 401, except sign-up, sign-in and refresh.

**Status:** Not started.

**Tests:**
- Access token expires after 1 hour; refresh token after 2 weeks.
- Refresh returns new tokens; reusing the old refresh token is rejected.
- Revoked refresh token is rejected.
- Unauthenticated API calls return 401.

### Step 9: Client session storage, restore and refresh
**Covers:** FR-A1, FR-A3, FR-A4, FR-A5, FR15, FR16

**Details:**
- Replace the single token in `client/src/lib/api.ts` with access and refresh tokens plus expiry times.
- A central auth service owns `unauthenticated | authenticated | offline`; route guards read it.
- Restore the stored session at startup before the first route renders; refresh silently if the access token has expired.
- 401 interceptor in `api.ts` with a single-flight refresh and one retry, then login.
- Remember a share link opened while signed out and resume it after login or refresh.

**Status:** Not started.

**Tests:**
- Valid session restored on reload; expired access token with valid refresh refreshes silently; both expired shows login.
- Concurrent 401s trigger one refresh call.
- Unauthenticated access to any route shows login.

### Step 10: Connectivity, offline banner and re-validation
**Covers:** FR-A6, FR-A7, FR-A8, FR-A9

**Details:**
- Detect connectivity with `navigator.onLine` and `online`/`offline` events, confirmed by a failed request.
- Ionic `OfflineBanner` at the app shell shows "Operating offline" and the app keeps using cached data.
- On reconnect and on app resume, run the same expiry check as startup: refresh, show login, or hide the banner.
- Defer a failed refresh while offline without signing the user out.

**Status:** Not started.

**Tests:**
- Going offline shows the banner and cached data stay usable.
- Reconnect with valid tokens hides the banner; expired access token refreshes; both expired shows login.
- Offline user with no session sees login with a connection-needed message.

## Implementation Status

See the status table at the start of Implementation Steps. Update it and each step's **Status** line as work progresses.
