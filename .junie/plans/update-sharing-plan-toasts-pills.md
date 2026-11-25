---
sessionId: session-261125-092341-1mnk
---

# Requirements

### Overview & Goals
Update `docs/feature-sharing.md` (and the Sharing summary in `docs/features.md`, `feature-manage-orders.md`, `feature-restaurant-list.md` where they describe lists/detail) with three UX changes. No code changes.

### Functional Requirements
1. **Toasts:** Sharing status messages are temporary `ion-toast` messages, not inline text. E.g. sharing success shows a success toast "Shared with X Friend(s)". Applies to share, unshare, save, and offline/error outcomes (error/warning colors).
2. **Order details:** The "Shared with" section becomes a collapsible list (ion-accordion). Header: label, a pill with the count of friends shared with, and a chevron indicating open/closed. Expanding shows the friends and their Unshare buttons. Collapsed by default.
3. **Lists:** Order list shows a "Shared" pill on an order that is shared with anyone, otherwise no pill. Restaurant list shows a "Shared" pill on a restaurant if any order beneath it is shared, otherwise none. Pills update after sharing/unsharing.

### Out of Scope
Shared tab (recipient side) badges; link-share status pills (can reuse the same pill later).

# Technical Design

### Proposed Changes to docs/feature-sharing.md
- **Sharing an order** requirements: add toast bullet, collapsible "Shared with" bullet, and pill bullets for order and restaurant lists.
- **Resolved decisions:** add toast and pill decisions.
- **Step 2:** add toast on share success/offline-block; tests for toast text "Shared with N Friend(s)".
- **Step 3:** replace "owner sees who an order is shared with" with the collapsible panel (count pill, chevron, unshare inside); add toast on unshare/save; add list pills (order and restaurant) with tests: pill shown when shared, hidden when not, restaurant pill when any order shared, pill clears after last unshare.
- **Implementation Status:** note in Steps 2 and 3 that the UX changes are pending (status moves back to In progress for the affected items).

### Implementation notes
- Use Ionic `ion-toast` (duration ~2–3s, color success/danger/warning), `ion-accordion-group` with `ion-badge` pill in the header slot; the chevron comes from the accordion toggle icon.
- Lists need a shared flag/count per order; the restaurant flag is derived from its orders (API or client aggregation).

# Delivery Steps

### ✓ Step 1: Update sharing requirements and decisions
feature-sharing.md requirements describe toasts, collapsible panel and list pills.

- Edit 'Sharing an order' section with toast, accordion (count pill + chevron, unshare inside), and Shared pills on order and restaurant lists.
- Add entries to Resolved decisions.

### ✓ Step 2: Update implementation steps, tests and status
Steps 2 and 3, their tests and the status table reflect the new behavior.

- Step 2: toast 'Shared with N Friend(s)' and offline toast tests.
- Step 3: collapsible panel, unshare/save toasts, order and restaurant pill tests.
- Update status notes; sync related lines in features.md, feature-restaurant-list.md and feature-manage-orders.md.