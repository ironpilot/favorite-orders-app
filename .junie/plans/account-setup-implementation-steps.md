---
sessionId: session-261124-114557-a6ac
---

# Requirements

### Overview & Goals
Add an **Implementation Steps** section to `docs/feature-account-setup.md` (the only feature doc lacking one). It breaks Account Creation and Sign Up into ordered, usable, reviewable increments. Documentation-only change; no `client/` or `server/` code is touched.

### Scope
- In scope: new section placed after Open Questions, matching `feature-restaurant-list.md` and `feature-manage-orders.md` (intro sentence, numbered steps with Covers FR numbers, Tests, and an Implementation Status table).
- Out of scope: changing existing requirements, code changes.

### Functional Requirements
- Steps are ordered by dependency; each is a usable increment and small enough to review.
- Every FR1-FR19 is covered by at least one step.
- Each step lists Covers, Details and Tests; all statuses start as `Not started` (to be verified against `client/` and `server/`).

# Technical Design

### Current Implementation
`docs/feature-account-setup.md` ends at `### Open Questions`. Sibling docs use `## Implementation Steps` with a short intro, then steps, then `## Implementation Status`.

### Key Decisions
- Steps follow a vertical-slice order so the app is usable after each one.
- Existing code is checked first so statuses are accurate (some auth may already exist).

### Proposed Steps (content of the new section)
1. **Sign-up and sign-in basics** (FR1, 2, 3, 4, 8, 13, 19): account model with unique email/phone, validation, password rules, sign-up and sign-in screens, auth-gated app, landing on the restaurant list.
2. **Email verification** (FR5, 6, 7): codes/links valid 15 min, resend limits 1/min and 5/hour, new code invalidates old, unverified users redirected, landing after verifying.
3. **Sign out and forgot password** (FR9, 10): sign-out, emailed time-limited reset link.
4. **Edit profile** (FR11, 14): change name, email, phone, password; email re-verification keeps old email active; uniqueness kept.
5. **Delete account** (FR12): confirmation and removal of orders, restaurants, shares, friendships.
6. **Share link sign-up and signed-in access** (FR15, 16): remember a link through sign-up and verification, then open it.
7. **Offline behavior** (FR17, 18): block sign-up, sign-in, recovery, edit and delete offline with a connection-needed message; sign-out works offline.

### Risks
- Overlap with sharing and restaurant-list docs: reference them in Details instead of duplicating.
- Status accuracy: inspect existing auth code before marking steps.

# Testing

### Validation Approach
Re-read the edited doc.

### Key Scenarios
- FR1-FR19 each appear in some step's Covers line.
- Step numbering and the Status table match.

### Edge Cases
- Markdown tables render correctly; no existing requirement text changed.

# Delivery Steps

### ✓ Step 1: Inspect existing auth code and draft step list
The step breakdown and accurate statuses are decided.

- Review `client/` and `server/` for existing sign-up, sign-in and verification code.
- Review the format of `Implementation Steps` in `docs/feature-restaurant-list.md` and `docs/feature-manage-orders.md`.
- Map FR1-FR19 onto the seven ordered steps.

### ✓ Step 2: Write Implementation Steps section in feature-account-setup.md
`docs/feature-account-setup.md` has a complete Implementation Steps section.

- Add the intro sentence and seven steps, each with Covers, Details and Tests.
- Keep the steps ordered by dependency and small enough to review.
- Reference the Restaurant List, Sharing and Manage Orders docs where steps overlap.

### ✓ Step 3: Add Implementation Status table and verify coverage
The doc has a status table and every requirement is covered.

- Add an `Implementation Status` section with a table of steps and statuses.
- Check that each FR is covered, the numbering is consistent, and the tables are valid Markdown.