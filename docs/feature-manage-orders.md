# Manage Favorite Orders

## Summary
Manage Favorite Orders lets users record, update and remove the favorite orders they have at each restaurant. Orders belong to a restaurant: one restaurant can hold several orders, and each order can be changed on its own without changing the restaurant. Each order is made up of items with a quantity and optional customizations, such as a Hamburger with no lettuce, added onions, and mayonnaise instead of ketchup. Orders are private to the owner until the owner shares them.

## Goals
- Make it quick and easy to record a favorite order at a restaurant.
- Let users keep several orders per restaurant and edit each one independently.
- Let users describe exactly what they order: items, quantities and per-item customizations.
- Let users start from an existing restaurant or create a new one while adding an order.
- Let users choose one order per restaurant as the default, so the restaurant list can preview it.
- Keep orders private to their owner until shared.
- Provide a fast, touch-friendly, one-handed experience on phones, scaling acceptably to tablet and desktop.

## Requirements

### Functional Requirements
1. **Add an order:** The user can add a favorite order from a prominent "add order" action. The flow is: tap add, choose a restaurant, add items and customizations, save.
2. **Choose or create a restaurant:** When adding an order, the user can select an existing restaurant (administrator-owned or their own) or create a new restaurant at that time. User-created restaurants are entered manually, with no external restaurant lookup.
3. **New restaurant appears in the list:** Saving an order at a new restaurant makes that restaurant appear in the user's restaurant list. Saving an order at an existing restaurant does not create a duplicate entry.
4. **Orders belong to restaurants:** Each order is a sub-item of one restaurant. A restaurant can have multiple orders.
5. **View orders at a restaurant:** The user can open a restaurant and see its orders.
6. **Independent editing:** Each order can be updated individually. Changing an order does not change the restaurant or the restaurant's other orders.
7. **Update an order:** The user can edit an order's name, items, quantities, customizations and notes, then save. An order cannot be moved to a different restaurant (not in v1); the user re-creates it instead.
8. **Remove an order:** The user can remove an order from a restaurant. Removing the last order at a restaurant leaves the restaurant in the list as an empty entry until the user removes the restaurant.
9. **Order items:** Each order has a list of order items. The user can add, edit and remove items in the list. An order must have at least one item to be saved.
10. **Item quantity:** Each order item has a quantity. The default is 1, and the user can change it. The minimum is 1; there is no upper limit on quantity or on the number of items per order.
11. **Item customizations:** Each order item can have customizations of three kinds: removals (e.g. No Lettuce), additions (e.g. add Onions) and substitutions (e.g. Mayonnaise instead of Ketchup). An item can have several customizations, or none.
12. **Notes:** An order can have free-text notes.
13. **Default order:** The user can mark one order per restaurant as its default. The default order's items are used for the preview on the restaurant list. When a restaurant has only one order, that order is the default. When the default order is deleted and other orders remain, the most recently updated remaining order becomes the default.
14. **Order detail view:** The user can open a simple detail view of an order that shows its items, quantities, customizations and notes, and offers a share action.
15. **Privacy:** Orders are private by default and visible only to the owner until the owner shares them.
16. **Offline behavior:** The user can view saved orders while offline (read-only). Creating, editing and deleting orders require a connection. While offline, the "add order" action is disabled and a message explains that a connection is needed.
17. **Order name:** An order can have an optional name (e.g. "Game night"). If it has no name, it is identified by its items. The name is shown in the order detail view.
18. **Rename a restaurant:** The user can rename a restaurant they created. Its orders stay attached to it. Renaming does not merge restaurants, so two restaurants can end up with the same name. Administrator-owned restaurants cannot be renamed by users.
19. **Restaurant ownership:** A restaurant is either administrator-owned or user-created. Administrator-owned restaurants are pre-populated, are not editable (renamed or removed) by users, and are available to all users. User-created restaurants belong to the user who created them and are visible only to that user.
20. **Restaurant auto-fill:** In the add-order restaurant field, suggestions appear as the user types, matching both administrator-owned restaurants and the user's own restaurants. If the user picks a suggestion, the order is saved under that restaurant. If no suggestion is chosen, the typed name creates a new user-created restaurant when the order is saved.
21. **Toppings auto-fill:** When adding a customization (removal, addition or substitution) to an item, the text field offers an autocomplete of common toppings (e.g. Lettuce, Onions, Ketchup, Mayonnaise). The list is predefined and maintained by the administrator. The user can still type any free text that is not in the list.
22. **Order list refresh on entry:** The restaurant's orders page (the order list) reloads its contents every time the user enters or returns to it (first entry, back navigation, switching tabs, returning from the add, edit or delete flows). The refresh keeps the current search text and sort choice where the page has them. If the refresh fails, the previous content stays visible and an error message is shown.
23. **Pull to refresh:** The user can pull down on the restaurant orders page to reload it on demand, using the Ionic refresher. A failed or offline pull-to-refresh keeps the current list and shows a non-destructive message. While offline, a refresh keeps the cached orders and shows a message that a connection is needed.
24. **Order detail refresh after edit:** After the user saves an edit to an order, they return to that order's detail view, which immediately shows the saved name, items, quantities, customizations and notes without a manual refresh. The detail view also reloads whenever it is entered again. Saving returns to the existing detail view rather than opening a second copy of it.

### Constraints and Assumptions
- Mobile-first, built with Ionic, with acceptable layout on tablet and desktop.
- Must work across the supported platforms: iOS, Android and a PWA.
- Restaurants are entered manually; there is no third-party places or restaurant data.
- There is no standalone way to add a restaurant without an order; restaurants are created while adding an order. No "Add a restaurant" button is provided anywhere in the app.
- Order history and versioning are not included at this time; only the order's last-updated time is kept.
- Administrator-owned restaurants and the common toppings list are managed by the administrator, outside the user-facing app.
- Restaurants with different spellings are separate entries and are not merged.
- Users have up to roughly 100 restaurants; no special large-list handling is needed.

### Dependencies
- **Account Creation and Sign Up:** orders are saved under the signed-in user's own account.
- **Restaurant List:** shows the restaurants created here, the order count, and the default order's items, and is the starting point for adding an order and opening a restaurant.
- **Share an Order with Another User:** uses the share action on the order detail view. Only accepted friends can receive a shared order.
- **Text an Order:** uses the text button on the order detail view.
- **Browse Shared Orders:** shared orders appear there, not among the user's own orders. The Shared list also gets pull-to-refresh; that is owned by the Browse Shared Orders feature. The same applies to any other list page, such as the friends list.

### Edge Cases
- A new user with no restaurants adds a first order, creating a restaurant in the same flow.
- The last order at a restaurant is removed (the restaurant stays as an empty entry).
- A restaurant with orders but no default marked.
- A restaurant with only one order.
- The default order is deleted.
- An order item left at the default quantity of 1.
- An item with no customizations, or with several of mixed kinds.
- An attempt to save an order with no items (not allowed).
- A restaurant renamed to the same name as another restaurant.
- A very long restaurant name, item name or note.
- The user is offline when trying to add, edit or delete an order.
- The same restaurant entered with slightly different spelling (kept as a separate entry).
- A user types the name of an administrator-owned restaurant but does not pick the suggestion (a separate user-created restaurant is created).
- A user tries to rename or remove an administrator-owned restaurant (not allowed).
- A topping typed by the user is not in the common toppings list (accepted as free text).
- A user-created restaurant has the same name as an administrator-owned restaurant (both appear in suggestions).
- The user returns from editing or deleting an order and sees the change without a manual refresh.
- The user saves an edit and the order detail view shows the updated order right away.
- A refresh of the orders page fails (the previous orders stay visible and an error message is shown).
- A refresh of the orders page happens while offline (the cached orders stay and a connection-needed message is shown).
- A refresh happens while a search or sort is active (the search text and sort choice are kept).

### Decisions
- A lone order is the default; when the default is deleted, the most recently updated remaining order becomes the default.
- An order needs at least one item.
- Quantity minimum is 1, with no upper limit and no cap on items per order.
- Orders have an optional name.
- Restaurants can be renamed; orders follow.
- Orders cannot be moved between restaurants in v1.
- Restaurants are only created while adding an order.
- "Most recently updated" includes order edits.
- Restaurant list search also matches item names.
- Restaurants are administrator-owned (read-only for users) or user-created.
- Restaurant auto-fill and toppings auto-fill are suggestions only; free text is always allowed.
- No order history or versioning at this time.
- Refresh on entry means every page activation (Ionic `ionViewWillEnter` style), not only the first mount.
- Pull-to-refresh applies to all list pages in the app.
- After an edit is saved, the open order detail view is updated with the saved order and reloads on re-entry.

### Open Questions
None at this time.


## Implementation Steps

Each step is a usable increment that builds on the previous one and is small enough to review on its own. Some of this feature (restaurants, plain-text orders, default order, restaurant removal) already exists from the Restaurant List steps; these steps replace or extend it as noted.

| Step | Title |
|------|-------|
| 1 | Structured order data and API |
| 2 | Add an order with items and customizations |
| 3 | Restaurant ownership and auto-fill |
| 4 | Toppings auto-fill |
| 5 | View orders, order detail and default order |
| 6 | Edit and remove an order |
| 7 | Rename a restaurant |
| 8 | Offline behavior |
| 9 | Polish and cross-platform check |

### Step 1: Structured order data and API
- **Outcome:** The server stores orders as a restaurant sub-item with an optional name, notes, a list of items (quantity, default 1) and per-item customizations (remove, add, substitute), all scoped to the signed-in owner.
- **Covers:** FR4, FR9, FR10, FR11, FR12, FR15, FR17
- **Decision:** Items and customizations are stored in their own tables and replace the current plain-text storage. The server rejects an order with no items or a quantity below 1, and ignores any owner id sent by the client.
- **Acceptance check:** Create, read, update and delete work through the API. Another user cannot read or change the order.

#### Tests
- An order with several items and mixed customizations round-trips unchanged.
- An order with no items is rejected.
- A quantity below 1 is rejected, and a large quantity is accepted.
- Quantity defaults to 1.
- An order without a name is accepted.
- Another user cannot read, update or delete the order.
- An order cannot be moved to a different restaurant.

### Step 2: Add an order with items and customizations
- **Outcome:** From a prominent "add order" action, the user fills in a restaurant name, items with quantity, customizations, an optional name and notes, and saves.
- **Covers:** FR1, FR3, FR6, FR9, FR10, FR11, FR12, FR17
- **Decision:** The restaurant is still a typed name in this step. A new name creates the restaurant and the order together, and an existing name reuses the restaurant without a duplicate.
- **Acceptance check:** A new user adds a first order and sees the new restaurant in the list. Saving is blocked with a clear message when there are no items.

#### Tests
- The add-order action opens the form.
- Items can be added, edited and removed, and quantity starts at 1.
- Remove, add and substitute customizations can be added to an item, mixed on one item, or left out.
- Saving without items is blocked.
- Saving at a new restaurant adds it to the list.
- Saving at an existing restaurant does not create a duplicate.
- A very long restaurant name, item name or note is limited or truncated without breaking the layout.

### Step 3: Restaurant ownership and auto-fill
- **Outcome:** Restaurants are administrator-owned or user-created, and the restaurant field suggests both as the user types.
- **Covers:** FR2, FR19, FR20
- **Decision:** Administrator-owned restaurants have no user owner, are seeded outside the app, and are read-only for users. Picking a suggestion saves the order under that restaurant, and typing without picking creates a new user-created restaurant. There is no "Add a restaurant" button.
- **Acceptance check:** Typing shows matching administrator-owned and own restaurants. Another user's restaurants never appear.

#### Tests
- Suggestions include administrator-owned and the user's own restaurants.
- Another user's restaurants are never suggested.
- Picking an administrator-owned suggestion saves the order under it and does not create a copy.
- Typing an administrator-owned name without picking creates a separate user-created restaurant.
- A user-created restaurant with the same name as an administrator-owned one shows both in suggestions.
- A slightly different spelling creates a separate entry.
- No "Add a restaurant" button exists anywhere.

### Step 4: Toppings auto-fill
- **Outcome:** Customization fields suggest common toppings, and free text is still accepted.
- **Covers:** FR21
- **Decision:** The toppings list is seeded and maintained by the administrator outside the app, and the client only reads it. Suggestions never restrict input.
- **Acceptance check:** Typing "let" in a customization offers "Lettuce", and a topping not in the list can still be saved.

#### Tests
- The server returns the toppings list to a signed-in user.
- Suggestions filter as the user types in remove, add and substitute fields.
- Both parts of a substitution can use suggestions.
- A topping not in the list is saved as typed.
- The app works when the toppings list is empty.

### Step 5: View orders, order detail and default order
- **Outcome:** The user opens a restaurant to see its orders, opens an order detail view, and can mark one order as the default.
- **Covers:** FR5, FR13, FR14, FR22, FR23
- **Decision:** A lone order is the default. The detail view shows items, quantities, customizations, name and notes, and has a share action that is a hook for the Share an Order feature.
- **Acceptance check:** The restaurant orders page lists its orders, the detail view shows everything, and changing the default updates the preview on the restaurant list.

#### Tests
- A restaurant shows all its orders.
- An order without a name is identified by its items.
- The detail view shows items, quantities, customizations, name and notes.
- The first order at a restaurant is the default.
- Marking another order as the default makes only that one the default.
- The share action is present on the detail view.
- A restaurant with orders but no default marked does not break the page.
- The orders page reloads on first entry and on every return (back navigation, tab switch, return from add, edit or delete).
- After editing or deleting an order and returning, the page shows the change.
- Pulling down on the orders page reloads it and ends the refresher when done.
- A failed refresh keeps the previous orders visible and shows an error message.
- A failed pull-to-refresh ends the refresher and shows a non-destructive message.

### Step 6: Edit and remove an order
- **Outcome:** The user can edit any order independently and remove an order, with default handling.
- **Covers:** FR6, FR7, FR8, FR13
- **Decision:** Any edit updates the order's last-updated time. When the default is deleted, the most recently updated remaining order becomes the default. Removing the last order keeps the restaurant as an empty entry. The restaurant cannot be changed when editing.
- **Acceptance check:** Editing one order changes neither the restaurant nor other orders. Deleting the default promotes the right order.

#### Tests
- Editing an order's name, items, quantities, customizations and notes saves correctly.
- Editing one order leaves the restaurant and other orders unchanged.
- An edit updates the last-updated time.
- The restaurant field is not editable on an existing order.
- Deleting the default promotes the most recently updated remaining order.
- Deleting the last order leaves the restaurant as an empty entry.
- Saving an edit with no items is blocked.

### Step 7: Rename a restaurant
- **Outcome:** The user can rename a restaurant they created, and its orders stay attached.
- **Covers:** FR18, FR19
- **Decision:** Renaming never merges restaurants. There is no order history, so only the last-updated time changes.
- **Acceptance check:** The new name appears in the list and on the orders page. Administrator-owned restaurants cannot be renamed.

#### Tests
- Renaming a user-created restaurant shows the new name everywhere and keeps its orders.
- Renaming to the same name as another restaurant keeps both entries.
- Renaming an administrator-owned restaurant is rejected.
- Another user cannot rename the restaurant.

### Step 8: Offline behavior
- **Outcome:** Saved restaurants and orders can be viewed offline, read-only.
- **Covers:** FR16, FR22, FR23 (refresh while offline)
- **Decision:** Reads are cached locally. Create, edit and delete need a connection, and there is no offline write queue.
- **Acceptance check:** With no connection, orders load from the cache, and add, edit and delete are disabled with a message that a connection is needed.

#### Tests
- With no connection, a restaurant's orders and the order detail load from cache.
- The add-order action is disabled while offline and a message explains why.
- Edit, delete and default actions are disabled while offline.
- Actions are enabled again when the connection returns.
- Toppings and restaurant auto-fill do not break the form when offline.
- Refreshing the orders page (on entry or by pull-to-refresh) while offline keeps the cached orders and shows a connection-needed message.

### Step 9: Polish and cross-platform check
- **Outcome:** The feature works well across devices and platforms and handles the listed edge cases.
- **Covers:** Constraints and Edge Cases
- **Acceptance check:** Layouts are acceptable on phone, tablet and desktop. The flows work on iOS, Android and the PWA. Every listed edge case is checked.

#### Tests
- The add-order form is usable one-handed on a phone and acceptable on tablet and desktop.
- The flows work on iOS, Android and the PWA.
- Each edge case in the Edge Cases section is checked.


## Implementation Status

Tracks progress of each implementation step. Update this section whenever a step changes. Status values: `Complete`, `Partial` (what is done and what remains), `Not started`. Last reviewed 2026-11-20 against the code in `client/` and `server/`.

| Step | Title | Status |
|------|-------|--------|
| 1 | Structured order data and API | Complete |
| 2 | Add an order with items and customizations | Complete |
| 3 | Restaurant ownership and auto-fill | Not started |
| 4 | Toppings auto-fill | Not started |
| 5 | View orders, order detail and default order | Complete |
| 6 | Edit and remove an order | Complete |
| 7 | Rename a restaurant | Partial |
| 8 | Offline behavior | Not started |
| 9 | Polish and cross-platform check | Not started |

### Details
- **Step 1: Complete.** Items (`order_items`, quantity default 1) and customizations (`order_item_customizations`: remove/add/substitute) are stored in their own tables. Old JSON items are migrated on startup, and old customization text is appended to notes. The server rejects an order with no items, a quantity below 1, invalid customizations, over-long text and a restaurant change on update. It ignores any owner id sent by the client. Covered by server tests.
- **Step 2: Complete.** The add-order form has an item list with a quantity stepper (starts at 1) and per-item remove/add/substitute customizations, plus an optional name and notes. Saving without items is blocked with a message, inputs have length limits, and long text wraps. Covered by client tests.
- **Step 3: Not started.** Restaurants only have a user owner today. There is no administrator-owned restaurant support, no auto-fill, and no suggestion endpoint.
- **Step 4: Not started.** There is no toppings list, endpoint or autocomplete.
- **Step 5: Complete.** The restaurant orders page lists orders (unnamed orders are identified by their items), opens an order detail view, and has a "Make default" action plus a hint when no default is marked. The detail view (`OrderDetailPage.vue`) shows name, items, quantities, customizations and notes, and has a share action that calls the `shareHandler` hook for the Share an Order feature. The orders page reloads on every entry (`ionViewWillEnter`) and has pull-to-refresh; a failed refresh keeps the previous orders and shows an error, and the refresher always ends. Covered by server and client tests.
- **Step 6: Complete.** The detail view has Edit and Remove (with confirmation) actions. Editing reuses the add-order form at `/tabs/restaurants/:id/orders/:orderId/edit` with the restaurant field locked, saves via `PATCH` (updating the last-updated time), and blocks saving without items. Deleting the default promotes the most recently updated remaining order, and removing the last order keeps the restaurant as an empty entry. Covered by server and client tests.
- **Step 7: Partial.** Done: server rename endpoint for a restaurant the user owns. Remaining: rename action in the client, administrator-owned restaurants being non-renamable, and tests.
- **Step 8: Not started.** There is no cache, offline detection or disabled add-order state, and no refresh-while-offline behavior (FR22, FR23).
- **Step 9: Not started.** It depends on steps 1 to 8.
