---
sessionId: session-261118-164403-y33h
---

# Requirements

### Overview & Goals
Add an **Implementation Steps** section to `docs/feature-restaurant-list.md`. It breaks the Restaurant List feature into small, ordered steps. Each step is a usable increment that can be reviewed comfortably.

### Scope
- In scope: a new `## Implementation Steps` section at the end of `docs/feature-restaurant-list.md`, after Open Questions.
- Out of scope: any code, and changes to the existing requirements.

### Functional Requirements
- Each step has a title, a one-line outcome and the requirement numbers it covers (FR1–FR16).
- Steps are ordered so each builds on the previous one.
- Every functional requirement is covered by at least one step.
- Steps that depend on open questions state the assumption they make.

# Technical Design

### Current Implementation
`docs/feature-restaurant-list.md` has Summary, Goals, Requirements (FR1–16), Constraints, Dependencies, Edge Cases and Open Questions. The repo has no app code yet (`index.js` and a stub `package.json`). The doc names Ionic, with iOS, Android and PWA targets.

### Proposed Changes
Append this section:

1. **Restaurant data and list screen skeleton** (FR1, 2, 3, 6, 8, 9). Define the restaurant and order model. Build the Ionic landing screen with navigation. Show each restaurant's name and order count from the user's own data.
2. **Default order and key-items preview** (FR3, 15). Add the default-order marker. Show its items as the preview, with a fallback for restaurants that have no orders or no default. Assumes a lone order is the default, and a new default is chosen when the default is deleted.
3. **Select restaurant and add-order entry point** (FR4, 5, 7). Open a restaurant's orders. Add the prominent add-order action. New restaurants appear after saving an order.
4. **Empty states** (FR11, 15). Show the first-order prompt when there are no restaurants. Show the add-order prompt on empty restaurant entries. Cover long names.
5. **Search and sort** (FR12, 13, 16). Search by restaurant name only. Sort by most recently updated (default) or A–Z. Show a no-matches state. Spelling variants stay separate.
6. **Remove a restaurant** (FR7, 14). Remove a restaurant with an explicit action. Ask for confirmation if it still has orders. Empty restaurants stay until removed.
7. **Offline support** (FR10). Cache restaurants and orders for read-only offline viewing. Disable add-order and edit actions while offline, with an explanatory message.
8. **Polish and cross-platform check** (Constraints). Check phone, tablet and desktop layouts and the three platforms. Check the ~100-restaurant size and the edge cases.

Each step also lists its main acceptance check.

# Testing

### Validation Approach
Review the edited doc. Check that FR1–FR16 each map to a step, that steps are in dependency order, and that existing sections are unchanged.

# Delivery Steps

### ✓ Step 1: Draft ordered Implementation Steps
The doc has a new Implementation Steps section listing steps 1–8 in order.

- Append `## Implementation Steps` to `docs/feature-restaurant-list.md`.
- For each step, write a title, a one-line outcome, the FR numbers covered and a short acceptance check.
- Order the steps: data and list skeleton, default order and preview, selection and add entry point, empty states, search and sort, remove, offline, polish.

### ✓ Step 2: Verify coverage and assumptions
Every requirement is covered and assumptions are stated.

- Check FR1–FR16 each appear in at least one step.
- Note the assumptions made for the open questions (default order, search scope) inside the relevant steps.
- Confirm the existing sections are unchanged.