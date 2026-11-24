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
1. **Open the app:** A user who is not signed in and opens the app is offered sign-in or account creation (sign-up).
2. **Create an account:** The user signs up from a simple screen by providing name, email, phone and a password.
3. **Unique details:** Email and phone must each be unique to one account. If either is already used, the app shows a generic error message that does not reveal which detail is taken or whether an account exists.
4. **Input validation:** Missing or invalid sign-up information is rejected with clear messages. The password must be at least 8 characters and contain letters and numbers.
5. **Email verification:** The user must verify their email before using the app. The phone number is collected but not verified.
6. **Verification failures:** If the code or link expires or does not arrive, the user can request a new one. A code or link is valid for 15 minutes and the expiry time is clearly shown. Resending is limited to 1 per minute and 5 per hour, and a new code or link invalidates the previous one.
7. **Landing after sign-up:** After verifying, the user lands on the restaurant list (which shows an empty state pointing them to add their first order).
8. **Sign in:** A returning user signs in with email and password. An unverified user is directed to complete verification.
9. **Sign out:** The user can sign out of the app, including while offline.
10. **Forgot password / recovery:** The user can regain access if they forget their password. A time-limited reset link is emailed to the account's verified email.
11. **Edit profile:** The user can change their name, email, phone and password. Changing the email requires re-verification; until the new email is verified, the user keeps using the app and the old email stays active. Friend links stay attached to the account after changes. Changed email and phone must remain unique.
12. **Delete account:** The user can delete their account after confirmation. All their data is removed, including orders, restaurants, shares and friendships.
13. **Account ownership:** Orders and restaurants the user creates are associated with their account and are private to them until shared.
14. **Identifiers usable by friends:** The account's email and phone are what other users use to find them when sending friend requests (search is by email or phone, not by name).
15. **Signed-in access:** Signing in is required to use the app, including opening share links (share links are usable by anyone signed in; users without the app are sent to the app store or PWA).
16. **Share link sign-up:** If a new user signs up from a share link, the link is remembered and opens once they have verified their email and signed in.
17. **Offline behavior:** Sign-up and sign-in require a connection and are not allowed offline; a message explains that a connection is needed.
18. **Offline account actions:** Sign-out works offline. Recovery, edit profile and delete account are disabled while offline, with the same connection-needed message.
19. **Sign-up screen:** The screens are simple, phone-friendly, and built with Ionic components.

### Constraints and Assumptions
- Mobile-first, with acceptable layout on tablet and desktop.
- Must work on iOS, Android, and a PWA.
- Offline support covers viewing cached saved and shared orders only.
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

### Open Questions
None at this time.
