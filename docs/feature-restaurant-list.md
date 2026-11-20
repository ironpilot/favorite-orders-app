# Restaurant List

## Summary
The Restaurant List is the main screen users see after opening the app or signing up. It shows every restaurant where the user has recorded a favorite order, and lets them pick a restaurant to see the orders saved there. Restaurants are either pre-populated by the administrator or entered by the user, but the list shows only those where the user has recorded an order, plus empty entries for restaurants the user created.

## Goals
- Give users a quick, at-a-glance view of the restaurants where they have favorite orders.
- Make it fast to get from the list to the orders saved at a specific restaurant.
- Make it easy to start adding a new favorite order from the list.
- Provide a fast, touch-friendly, one-handed experience on phones, scaling acceptably to tablet and desktop.
- Keep the list usable when the user has no connection.

## Requirements

### Functional Requirements
1. **View restaurants:** The user can see a list of the restaurants where they have recorded favorite orders.
2. **Landing screen:** After opening the app (signed in) or completing sign-up, the user lands on the restaurant list.
3. **Restaurant entry:** Each restaurant in the list shows its name, its order count, and the items of its default order as the key-items preview.
4. **Select a restaurant:** The user can select a restaurant to see the orders recorded at it.
5. **Add order entry point:** The list provides a prominent "add order" action that starts the flow for adding a favorite order.
6. **Manual restaurants:** A restaurant appears in the list because the user entered it manually, by creating it at the time an order is added or by picking it again later, or because they saved an order at an administrator-owned restaurant. When adding an order, the user can pick an existing restaurant (administrator-owned or their own, via auto-fill) or create a new one. Each restaurant holds multiple orders; each order has its own items (quantity default 1) with per-item customizations (remove, add, substitute), and editing an order does not change the restaurant. There is no external restaurant lookup.
7. **List stays in sync with orders:** Adding an order at a new restaurant makes that restaurant appear in the list. Removing the last order at a restaurant keeps the restaurant in the list as an empty entry until the user removes it explicitly.
8. **Privacy:** The list shows only the user's own orders and the restaurants they are recorded at (administrator-owned or user-created); other users' restaurants are never shown. Orders are private to the owner until shared.
9. **Navigation:** The list is reachable through navigation suited to one-handed phone use, such as bottom tabs or a menu.
10. **Offline viewing:** The user can view the list of saved restaurants and their orders while offline (read-only). Actions that create, edit, or delete orders require a connection. While offline, the "add order" action is disabled and a message explains that a connection is needed.
11. **Empty state:** When the user has no recorded restaurants, the list shows an empty state that points them to add their first order.
12. **Search:** The user can search the list by restaurant name or by item name in its orders (e.g. searching "burger" finds restaurants with burger orders).
13. **Sorting:** The user can sort the list. The default is most recently updated first, with an A–Z option.
14. **Remove a restaurant:** The user can explicitly remove a user-created restaurant from the list (including one with no orders). Removing a restaurant that still has orders requires confirmation. Administrator-owned restaurants cannot be removed by users.
15. **Empty restaurant entry:** A restaurant with no orders shows its name and a prompt to add an order instead of a key-items preview.
16. **Duplicate names:** Restaurants with different spellings are treated as separate entries; names are not merged.
17. **Rename a restaurant:** The user can rename a restaurant they created. Its orders stay attached, and the list shows the new name. Administrator-owned restaurants cannot be renamed by users.

### Constraints and Assumptions
- Mobile-first, built with Ionic, with acceptable layout on tablet and desktop.
- Must work across the supported platforms: iOS, Android, and a PWA.
- User-created restaurants are entered manually; no third-party places or restaurant data. Administrator-owned restaurants are pre-populated and managed outside the app.
- No "Add a restaurant" button on the list or anywhere else; restaurants are only added when an order is created.
- Shared orders from friends are viewed in the separate "Browse Shared Orders" feature (separate tab), not in this list.
- The list is sized for up to roughly 100 restaurants; no special large-list handling is needed.

### Dependencies
- **Account Creation and Sign Up:** users land on this list after signing up.
- **Manage Favorite Orders:** supplies the orders and restaurants shown here, and the add/update/remove actions. Orders are sub-items of restaurants, each with order items (quantity default 1) and per-item customizations, and each order is editable individually. It must also let the user mark one order per restaurant as the default (used for the key-items preview). It also supplies administrator-owned vs. user-created restaurant ownership and restaurant auto-fill in the add-order flow.

### Edge Cases
- A new user with no orders (empty state).
- A restaurant whose last order was removed (stays as an empty entry).
- A restaurant with orders but no default marked.
- Multiple orders at one restaurant (shown as one list entry).
- Very long restaurant names or many restaurants.
- The user is offline when opening the list.
- Slightly different spellings of the same restaurant name entered manually (kept as separate entries).
- Search with no matches.
- A restaurant renamed to the same name as another restaurant.
- A user tries to rename or remove an administrator-owned restaurant (not allowed).
- A user-created restaurant has the same name as an administrator-owned one (both can appear as separate entries).

### Decisions
- A lone order is the default; when the default is deleted, the most recently updated remaining order becomes the default.
- Restaurants are only created while adding an order; there is no standalone add-restaurant action.
- "Most recently updated" includes new orders, order edits and default changes.
- The order count includes only the user's own orders.
- Search matches restaurant names and item names.
- Restaurants are administrator-owned (read-only for users) or user-created; no "Add a restaurant" button is provided.

### Open Questions
None at this time.

## Implementation Steps

Each step is a usable increment that builds on the previous one. Steps that depend on an open question state the assumption they make.

Each step has a **Status** line: `Complete`, `Partial` (with what is done and what remains), or `Not started`. Status last reviewed 2026-11-20 against the code in `client/` and `server/`.

| Step | Status |
|------|--------|
| 1. Restaurant data and list screen skeleton | Complete |
| 2. Default order and key-items preview | Complete |
| 3. Select restaurant and add-order entry point | Partial |
| 4. Empty states | Partial |
| 5. Search and sort | Not started |
| 6. Remove a restaurant | Partial |
| 7. Offline support | Not started |
| 8. Polish and cross-platform check | Not started |

### Step 1: Restaurant data and list screen skeleton
- **Status:** Complete. Server restaurant/order data, list page, bottom tabs, landing redirect and per-user filtering are implemented with unit and API tests.
- **Outcome:** A signed-in user lands on an Ionic restaurant list showing each restaurant's name and order count from their own data.
- **Covers:** FR1, FR2, FR3 (name and count), FR6, FR8, FR9
- **Assumption:** The order count includes only the user's own orders.
- **Acceptance check:** After sign-in or sign-up the list opens first, is reachable via bottom tabs or a menu, and shows only the current user's restaurants.

#### Tests
- A signed-in user lands on the restaurant list on app open.
- A new user lands on the restaurant list after sign-up.
- Each entry shows the restaurant name and order count.
- The order count includes only the user's own orders.
- The list shows only the current user's restaurants.
- The list is reachable through bottom tabs or a menu.

### Step 2: Default order and key-items preview
- **Status:** Complete. The server stores one default order per restaurant, the list shows its items, and the fallback text is shown otherwise. Preview and fallback have unit tests.
- **Outcome:** Each restaurant entry shows the items of its default order as a preview.
- **Covers:** FR3 (preview), FR15 (fallback)
- **Decision:** A lone order is the default. When the default order is deleted, the most recently updated remaining order becomes the default. A restaurant with orders but no default shows a sensible fallback.
- **Acceptance check:** One order per restaurant is marked default, and its items appear in the entry. Restaurants without a default or orders show the fallback without errors.

#### Tests
- A restaurant with one order uses it as the default.
- Deleting the default order makes the most recently updated remaining order the default.
- The default order's items appear as the preview in the entry.
- A restaurant with orders but no default shows the fallback.
- A restaurant with no orders shows the fallback without errors.

### Step 3: Select restaurant and add-order entry point
- **Status:** Partial. Done: selecting a restaurant opens its orders page, the add-order action and flow, saving an order at a new or existing restaurant by name, and multiple orders per restaurant. Remaining: restaurant auto-fill over administrator-owned and the user's own restaurants, administrator-owned restaurant support, common-toppings auto-fill for customizations, the picker for existing restaurants (the form currently takes a typed name), and structured order items with quantity (default 1) and remove/add/substitute customizations. Orders currently store items and customizations as plain text.
- **Outcome:** The user can open a restaurant to see its orders and start adding an order from a prominent action.
- **Covers:** FR4, FR5, FR6, FR7 (new restaurants appear)
- **Decision:** Restaurants are created at the time an order is added: the add-order flow lets the user pick an existing restaurant (administrator-owned or their own, via auto-fill) or create a new one by typing a name. There is no standalone add-restaurant action or button.
- **Orders:** Each order is a sub-item of its restaurant with a list of order items (quantity default 1), each with optional remove/add/substitute customizations.
- **Acceptance check:** Selecting an entry opens its orders. Saving an order at a new restaurant makes it appear in the list.

#### Tests
- Selecting a restaurant opens its orders.
- The add-order action is prominent and starts the add-order flow.
- Saving an order at a new restaurant adds it to the list.
- Saving an order at an existing restaurant does not create a duplicate entry.
- The add-order flow lets the user select an existing restaurant or create a new one.
- The restaurant field suggests administrator-owned and the user's own restaurants as the user types.
- Typing a name without picking a suggestion creates a new user-created restaurant.
- There is no standalone way to add a restaurant without an order.
- A restaurant can hold multiple orders, and editing one order changes neither the restaurant nor other orders.
- Order items default to quantity 1, and each item can have remove, add, and substitute customizations (e.g. Hamburger: No Lettuce, add Onions, Mayonnaise instead of Ketchup).

### Step 4: Empty states
- **Status:** Partial. Done: the empty state for a user with no restaurants. Remaining: confirm the add-order prompt for restaurants with no orders and the long-name layout, and add tests for both.
- **Outcome:** New users and empty restaurant entries get clear prompts to add an order.
- **Covers:** FR11, FR15
- **Acceptance check:** A user with no restaurants sees the first-order prompt. A restaurant with no orders shows its name and an add-order prompt. Very long names are handled without breaking the layout.

#### Tests
- A user with no restaurants sees the first-order prompt.
- The first-order prompt leads into the add-order flow.
- A restaurant with no orders shows its name and an add-order prompt.
- A very long restaurant name is truncated or wrapped without breaking the layout.

### Step 5: Search and sort
- **Status:** Not started. The list page has no search field or sort option.
- **Outcome:** The user can find restaurants by name or item and order the list.
- **Covers:** FR12, FR13, FR16
- **Decision:** Search matches restaurant names and item names. "Most recently updated" counts new orders, order edits and default changes.
- **Acceptance check:** Search filters by restaurant or item name, with a no-matches state. Sort defaults to most recently updated, with an A–Z option. Different spellings stay separate entries.

#### Tests
- Searching by part of a name filters the list.
- Searching by an item name (e.g. "burger") finds restaurants with a matching order item.
- A search with no matches shows the no-matches state.
- Clearing the search restores the full list.
- The default sort is most recently updated first.
- Adding or editing an order moves its restaurant to the top.
- The A–Z option sorts by restaurant name.
- Restaurants with different spellings appear as separate entries.

### Step 6: Remove a restaurant
- **Status:** Partial. Done: the server endpoint removes a restaurant and requires confirmation if it has orders, and deleting the last order leaves the restaurant in place. Remaining: the remove action and confirmation dialog in the client, and tests.
- **Outcome:** The user can explicitly remove a restaurant from the list.
- **Covers:** FR7 (empty entries stay until removed), FR14
- **Acceptance check:** Removing a restaurant with orders asks for confirmation. Removing an empty one works. A restaurant whose last order is deleted remains until removed.

#### Tests
- Removing a restaurant with orders asks for confirmation.
- Cancelling the confirmation keeps the restaurant and its orders.
- Confirming removes the restaurant from the list.
- Removing an empty restaurant works.
- Administrator-owned restaurants cannot be removed or renamed by users.
- Deleting the last order leaves the restaurant as an empty entry.

### Step 7: Offline support
- **Status:** Not started. There is no cache, offline detection, or disabled add-order state.
- **Outcome:** Saved restaurants and orders can be viewed offline, read-only.
- **Covers:** FR10
- **Acceptance check:** With no connection, the list and orders load from cache. Add-order and edit actions are disabled, with a message that a connection is needed.

#### Tests
- With no connection, the list loads from cache.
- With no connection, a restaurant's orders load from cache.
- The add-order action is disabled while offline and a message explains why.
- Edit and delete actions are disabled while offline.
- Actions are enabled again when the connection returns.

### Step 8: Polish and cross-platform check
- **Status:** Not started. It depends on steps 3 to 7.
- **Outcome:** The list works well across devices and platforms and handles the edge cases.
- **Covers:** Constraints and Edge Cases (mobile-first layout, tablet and desktop, iOS, Android and PWA, ~100 restaurants)
- **Acceptance check:** Layouts are acceptable on phone, tablet and desktop. The list behaves on all three platforms with ~100 restaurants. Every listed edge case is checked.

#### Tests
- The layout is acceptable on phone, tablet and desktop sizes.
- The list works on iOS, Android and the PWA.
- The list stays usable with about 100 restaurants.
- Each edge case in the Edge Cases section is checked.
