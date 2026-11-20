---
sessionId: session-261120-114628-v9px
---

# Requirements

### Overview & Goals
Add three refresh requirements to the feature plans in `docs/` and sync them to `docs/spec.md`. This is a documentation-only change: no source code is modified.

### New requirements
1. **Restaurant list auto-refresh:** The restaurant list reloads its data every time the user enters or returns to the page (first entry, back navigation, switching tabs, returning from add/edit/remove flows).
2. **Order list auto-refresh:** The restaurant's orders page (the order list) reloads its contents every time the user enters or returns to it.
3. **Pull to refresh:** Every list page supports pull-to-refresh so the user can reload on demand. List pages: restaurant list, restaurant orders list, and the Shared orders list (and any other list page such as the friends list).

### Scope
- In scope: `docs/feature-restaurant-list.md`, `docs/feature-manage-orders.md`, `docs/spec.md`. `docs/features.md` is checked only for consistency.
- Out of scope: any `client/` or `server/` code changes, and changes to the existing step statuses beyond noting new work.

### Functional details
- Refresh keeps the current search text and sort choice.
- Offline: refresh does not wipe the cached list. The user sees a message that a connection is needed and the cached data stays. Pull-to-refresh shows a non-destructive failure message.
- A failed refresh keeps the previous content visible and shows an error message.
- Pull-to-refresh uses the Ionic refresher, which suits one-handed mobile use.

# Technical Design

### Proposed Changes
**`docs/feature-restaurant-list.md`**
- Functional Requirements: add FR18 *Refresh on entry* and FR19 *Pull to refresh*.
- Offline viewing (FR10): note that refresh while offline keeps the cached list.
- Edge Cases: add a failed refresh, a refresh while offline, and a refresh that keeps the search and sort state.
- Implementation Steps: Step 1 gets the entry refresh, with its test. Step 7 (offline) gets the offline refresh behavior. Add the refresh tests in the matching steps and update the Covers lines. Step 1 is already Complete, so note under its Status that the refresh work is Not started, or add a new step "Refresh on entry and pull to refresh" to the table with status Not started. Renumbering is avoided by appending it as step 9, before nothing else changes.

**`docs/feature-manage-orders.md`**
- Functional Requirements: add FR22 *Order list refresh on entry* and FR23 *Pull to refresh*. Both apply to the restaurant orders page.
- Edge Cases: add the same refresh cases as above, plus returning from order edit or delete and seeing the change.
- Implementation Steps: extend Step 5 (view orders) with the refresh behavior and tests. Extend Step 8 (offline) with refresh-while-offline. Update the Implementation Status table and Details so the Step 5 Partial note lists the refresh as remaining.
- Dependencies: Browse Shared Orders and the Shared list also get pull-to-refresh, noted as owned by that feature.

**`docs/spec.md`**
- Functional Requirements: add bullets for refresh on entry (restaurant list and order list) and pull-to-refresh on all list pages.
- Non-Functional Requirements: add that refreshed data is shown without blocking the UI.
- User Flows: add a short flow, "Refresh a list".
- UI/UX Overview: add pull-to-refresh on all list pages.

### Key Decisions
- Refresh on entry means every page activation (Ionic `ionViewWillEnter` style), not only first mount.
- Pull-to-refresh applies to all list pages, not only the two named.
- Existing step numbers are not renumbered. Any new step is appended.

### Risks
- Wording must match across the three files. Mitigation: use the same sentences and re-read each file after editing.
- The "all list pages" scope could miss the friends or Shared lists. Mitigation: check `docs/features.md` and `docs/spec.md` for every list page and name them explicitly.

# Testing

### Validation Approach
Read back the edited docs and check them against the requirements.

### Key Scenarios
- Each of the three requirements appears in `spec.md` and in the relevant feature file with matching wording.
- Requirement numbers are unique and sequential, and step Covers lines reference them.
- New test bullets exist for entry refresh, pull-to-refresh, offline refresh and failed refresh.

### Edge Cases
- No existing step status is changed incorrectly.
- No broken tables or numbering in the Markdown.

# Delivery Steps

### ✓ Step 1: Add refresh requirements to the restaurant list feature plan
`docs/feature-restaurant-list.md` has the new refresh requirements, edge cases, and tests.

- Add FR18 (refresh on entry/return) and FR19 (pull to refresh).
- Update FR10/offline wording so a refresh keeps cached data and shows a connection message.
- Add edge cases: failed refresh, offline refresh, search and sort state kept.
- Add the refresh work to the implementation steps (extend Step 1 and Step 7, or append a new Not started step) with Covers lines and Tests.

### ✓ Step 2: Add refresh requirements to the manage orders feature plan
`docs/feature-manage-orders.md` has the order list refresh and pull-to-refresh requirements.

- Add FR22 (order list refreshes on entry/return) and FR23 (pull to refresh).
- Add edge cases: returning from edit or delete shows the change, failed refresh, offline refresh.
- Extend Step 5 and Step 8 with the behavior, Covers lines and Tests.
- Update the Implementation Status table and Details for the affected steps.
- Note in Dependencies that the Shared list also gets pull-to-refresh.

### ✓ Step 3: Sync the refresh requirements into spec.md
`docs/spec.md` reflects all three requirements, consistent with the feature plans.

- Add Functional Requirements bullets for refresh on entry (restaurant list and order list) and pull-to-refresh on all list pages.
- Add a "Refresh a list" user flow.
- Add pull-to-refresh to UI/UX Overview.
- Check `docs/features.md` for consistency, then re-read all edited files for matching wording and numbering.