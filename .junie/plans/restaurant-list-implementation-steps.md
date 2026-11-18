---

sessionId: session-261118-131427-1rmx
---

# Requirements

### Overview & Goals
Add an **Implementation Steps** section to `docs/feature-restaurant-list.md` that splits the Restaurant List feature into ordered, reviewable steps. Each step should deliver a usable slice of the feature and stay small enough to review comfortably.

### Scope
**In scope**
- A new `## Implementation Steps` section placed after the existing Requirements, Constraints, Dependencies, Edge Cases and Open Questions sections.
- Each step has a title, a short outcome, the requirement numbers it covers (1–16), and a dependency on earlier steps.
- Steps are ordered so that each builds on the previous one.

**Out of scope**
- Low-level technical decisions, file names and code. The doc stays product and behavior focused.
- Changes to `spec.md` and `features.md`.
- The Implementation Status and Tests sections. The prompts file lists them as separate follow-up prompts.
- Resolving the open questions. Steps note where an open question affects them.

### Functional Requirements
Proposed steps, in implementation order:
1. **Basic restaurant list and navigation** (reqs 1, 2, 4, 8, 9, 11): the list is the landing screen and is reachable through bottom navigation. It shows only the user's own restaurants, with an empty state. Selecting a restaurant opens its orders screen, which can be a placeholder until Manage Favorite Orders delivers it.
2. **Add order entry point and manual restaurants** (reqs 5, 6, 7): a prominent add-order action that starts the add flow. Saving an order at a new, manually typed restaurant makes it appear in the list.
3. **Order count and default-order preview** (reqs 3, 15, 16): each card shows the name, the order count and the default order's items. A restaurant with no orders shows an add-order prompt. Different spellings stay separate entries. This depends on the default-order marking in Manage Favorite Orders, and on the open question of which order is the default.
4. **Keep and remove restaurants** (reqs 7, 14): a restaurant stays as an empty entry after its last order is removed. The user can remove a restaurant explicitly, with confirmation if it still has orders.
5. **Search and sort** (reqs 12, 13): search by restaurant name, sort most recently updated first by default, with an A–Z option. Includes a no-matches state.
6. **Offline read-only viewing** (req 10): the list and its orders are viewable offline. The add-order action is disabled with a message explaining a connection is needed.
7. **Polish and edge cases**: very long names, about 100 restaurants, a restaurant with no default marked, and a first launch offline. Verify all requirements against the doc.

### Non-Functional Requirements
- Steps must respect the doc's constraints: mobile-first Ionic, iOS/Android/PWA, and no places API.

# Technical Design

### Current Implementation
The project root holds only `docs/`, `index.js` and `package.json`. There is no app code yet. The target file `docs/feature-restaurant-list.md` has Summary, Goals, Requirements (Functional, Constraints and Assumptions, Dependencies, Edge Cases, Open Questions). `docs/prompts.md` describes the wanted pattern: add an "Implementation Steps" section, and add Implementation Status and Tests as later steps.

### Proposed Changes
- Edit only `docs/feature-restaurant-list.md`. Append `## Implementation Steps` after Open Questions.
- Format each step as `### Step N: <title>`, followed by:
  - **Outcome:** one sentence on what the user can do.
  - **Covers:** the requirement numbers.
  - **Depends on:** the earlier steps or other features.
  - **Notes:** open questions or assumptions that affect the step, when relevant.
- Keep the text high level, with no schemas, file names or code, matching the rest of the doc.
- Use the seven steps in the Requirements tab, ordered from the foundation up to polish.

### Key Decisions
- Order is list first, then data entry, then richer cards, then removal, then search and sort, then offline, then polish. Each step ends in a working, testable app.
- Offline comes late because it needs the list and orders to exist.
- Steps referencing the default order are flagged, because the doc says the default-order concept is not yet in `spec.md`.

### Risks
- Steps 1–3 depend on Sign Up and Manage Favorite Orders. The doc will mark them as dependencies, or say the placeholders they can use.
- Unresolved open questions can change step 3 (default rules), step 4 (creating restaurants without orders) and step 5 (search scope). The doc will flag these.

# Delivery Steps

###   Step 1: Draft ordered Implementation Steps section
`docs/feature-restaurant-list.md` has a new `## Implementation Steps` section with seven ordered steps.

- Append the section after Open Questions.
- Write steps 1–7: basic list and navigation, add-order entry and manual restaurants, order count and default preview, keep and remove restaurants, search and sort, offline read-only, polish and edge cases.
- For each step include an outcome, the requirement numbers covered, and dependencies on earlier steps.
- Keep the wording high level, with no implementation details.

###   Step 2: Cross-check coverage and flag dependencies
Every functional requirement (1–16) is covered by at least one step, and dependencies are visible.

- Check that each requirement number appears in a step.
- Add notes on steps affected by open questions (default-order rules, creating restaurants without orders, search scope).
- Note the dependencies on Sign Up and Manage Favorite Orders, and any placeholder behavior in steps 1–3.
- Read the file back to check the formatting.
