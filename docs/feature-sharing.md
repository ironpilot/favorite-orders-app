# Friends and Sharing

## Summary
Friends and Sharing lets users connect with friends and family through friend requests, then share a favorite order directly with an accepted friend inside the app. The friend is notified, can view the shared order in their separate Shared tab, and can save it to their own orders. This is the primary feature of the app.

## Goals
- Let users build a private network of friends and family.
- Make sharing a favorite order with a friend quick and simple.
- Ensure orders stay private unless the owner explicitly shares them.
- Let recipients easily find, view, and save orders shared with them.
- Keep the experience fast and touch-friendly on mobile.

## Requirements

### Friends
- A user can search for another user by email or phone (not by name).
- A user can send a friend request to a found user.
- The recipient of a request can accept it or decline it. A declined request is silently removed; the sender is not told and may send a new request later.
- The sender can cancel a pending request before it is answered.
- A user can remove a friend. Removing a friend revokes the ex-friend's access to orders previously shared with them (they disappear from the Shared tab); orders the ex-friend already saved to their own orders remain.
- Users are notified (push) of incoming friend requests and of accepted requests.
- Once a request is accepted, both users are friends and can share orders with each other.
- Friends is a primary tab in the bottom tab bar (alongside Restaurants, Shared, and Profile), not nested under Profile.
- The Friends tab shows the user's friends and friend requests (sent and received) and offers a search field.
- The friends list supports pull-to-refresh and reloads when the user enters or returns to the screen.

### Sharing an order
- Orders are private by default and visible only to the owner until shared.
- Sharing is only allowed with accepted friends.
- A user can open an order and tap the Share button on the order detail view, which opens a sharing-options modal (`ion-modal`) titled "Share order". The modal holds the friend picker (and later the share-link options) and is closed with Close or Cancel, or automatically after a successful share.
- A user can select one or more friends in the picker; friends the order is already shared with are marked and cannot be shared with again.
- Sharing sends the order to the selected friends; it appears in each friend's shared orders and each friend is notified by push notification.
- A user can also share an order via a share link; see "Sharing via link" below.
- The owner can unshare an order from a friend, removing it from that friend's Shared tab.
- A shared order is read-only for the recipient and always shows the owner's latest version; if the owner edits it, the recipient sees the update, and if the owner deletes it, it disappears from the recipient's Shared tab.
- A recipient can save a shared order to their own orders. The copy goes under a restaurant matched by name from the recipient's available restaurants, or a new user-created restaurant if none matches. The saved copy is independent of the original.
- Sharing requires a network connection.
- Sharing status messages (shared, unshared, saved, offline, and errors) are temporary `ion-toast` messages, not inline text. For example, a successful share shows a success toast "Shared with X Friend(s)"; offline and error outcomes use warning or danger colors.
- On the order detail view, the "Shared with" section is a collapsible list (`ion-accordion`), collapsed by default. Its header shows the label, a pill with the number of friends the order is shared with, and a chevron indicating open or closed. Expanding it shows the friends and their Unshare buttons.
- The order list shows a "Shared" pill on an order that is shared with anyone, and no pill otherwise.
- The restaurant list shows a "Shared" pill on a restaurant if any order beneath it is shared, and no pill otherwise.
- The pills update after sharing or unsharing.

### Sharing via link
- The owner can generate a share link for an order from the share action, and chooses an expiry (or no expiry) when generating it.
- A link is reusable: anyone with the link can use it, and the owner can see everyone who has opened it.
- The opener must be signed in; if not, they are asked to sign in or sign up first, then the link resumes. The link is also remembered through a token refresh or re-login after the session expires (see `feature-account-setup.md`).
- If the link is opened by someone without the app installed, they are directed to the app store or the PWA, and the link resumes after install/sign-in.
- A link opener can save the order to their own orders, same as for friend shares.
- The owner can disable a link entirely, or remove individual openers' access.
- If an expired or disabled link is opened, the user is told it is no longer valid.
- If a link opener becomes a friend and the owner later unfriends them, their access to the link-shared order is revoked.
- Opening the link opens the app and grants the opener access to the order (read-only, same as a friend share); the opener does not need to be a friend of the owner.
- A user who opens a link is prompted whether they would like to become friends with the owner.
- If the user accepts the prompt, the app sends a friend request to the owner. The owner can accept or decline it as a normal friend request.
- If the request is declined, the order is removed from the opener's shared list.
- If the user chooses not to send a friend request, the order stays in their Shared tab.
- The owner can see that the order is shared via link (and with whom), and can revoke access at any time, even if the opener is not a friend.
- If the opener is already a friend of the owner, no friend prompt is shown.
- Like other shared orders, link-shared orders show the owner's latest version and disappear if the owner deletes the order.

### Receiving and browsing shared orders
- Shared orders appear in a separate Shared tab, not in the restaurant list.
- The Shared tab shows shared orders organized by restaurant or person.
- A user can select a restaurant or person and view the order details (items, quantities, customizations, name, notes).
- The Shared list supports pull-to-refresh and reloads when the user enters or returns to it.
- Shared orders can be viewed offline (read-only) from cached data.

### Refresh and error behavior
- A failed refresh keeps the previous content visible and shows an error message.
- A refresh while offline keeps cached data and shows a message that a connection is needed.
- Refreshing does not block the UI and preserves the previous content while it runs.

### Constraints and assumptions
- Users have an account (sign-up) before they can add friends or share.
- Orders to be shared already exist (see Manage Favorite Orders); they consist of items with quantities and optional customizations, plus an optional name and notes.
- No order history or versioning; only the last-updated time is kept.
- Sharing directly with a user is limited to accepted friends; share links are the stated exception.

### Out of scope
- Texting an order via SMS (separate feature).
- Managing restaurants, toppings, or order editing.

### Open questions
- None currently.

### Resolved decisions
- Friend search is by email or phone only.
- Declined requests are silently removed; senders can cancel pending requests.
- Unfriending revokes access to shared orders; saved copies remain.
- Shared orders reflect live updates; owners can unshare.
- Notifications are push, for received orders and friend requests/acceptances.
- Saving a shared order matches or creates a restaurant by name.
- Multiple friends can be selected when sharing; duplicates are prevented.
- The Share button opens a sharing-options modal rather than an inline picker; share-link options will be added to the same modal in Step 5.
- Sharing status messages are temporary toasts (success, warning, danger), not inline text.
- "Shared with" on order detail is a collapsible list with a count pill and chevron; order and restaurant lists show a "Shared" pill or nothing. Shared tab badges and link-share pills are out of scope for now.
- Share links: owner-chosen expiry, reusable by anyone signed in, openers can save, store/PWA fallback, owner can disable the link or remove individual openers, unfriending revokes access.

## Implementation Steps

Each step is a usable, reviewable increment and builds on the previous ones.

### Step 1: Friends
Deliver the Friends tab end to end.
- Friends is a primary tab in the bottom tab bar, not under Profile.
- Search for a user by email or phone.
- Send, cancel, accept, and decline friend requests (declines are silent).
- List friends and sent/received requests; remove a friend.
- Pull-to-refresh, reload on entry, and refresh error/offline messages on the friends list.

Done when two users can become friends and unfriend each other.

#### Tests
- The tab bar shows a Friends tab that opens the friends screen.
- Searching by exact email or phone finds a user; searching by name does not.
- Sending a request shows it as sent for the sender and received for the recipient.
- Accepting a request makes both users friends.
- Declining removes the request silently, and the sender can send a new one.
- The sender can cancel a pending request.
- Removing a friend removes them from both friends lists.
- Pull-to-refresh and reload on entry update the list; failed or offline refresh keeps content and shows a message.

### Step 2: Share an order with friends and browse the Shared tab
Make direct sharing usable.
- The Share button on the order detail view opens a sharing-options modal containing a multi-select friend picker; already-shared friends are marked and not selectable. The modal closes on Close/Cancel or after a successful share.
- Shared tab listing orders by restaurant or person, with a read-only detail view.
- Recipients always see the owner's latest version; deleted orders disappear.
- Pull-to-refresh and reload on entry for the Shared list; sharing requires a connection.
- Share outcomes appear as temporary `ion-toast` messages: a success toast "Shared with N Friend(s)" after sharing, and a warning toast when blocked while offline (danger on errors).

Done when a user can share an order with friends and they can view it in their Shared tab.

#### Tests
- Sharing is only possible with accepted friends.
- Tapping Share opens the sharing-options modal; Close or Cancel dismisses it without sharing, and a successful share closes it.
- Multiple friends can be selected; already-shared friends are marked and not selectable.
- A shared order appears in each recipient's Shared tab, grouped by restaurant or person.
- The shared detail view is read-only.
- Owner edits show up for the recipient; deleting the order removes it from the Shared tab.
- Unshared orders stay private to the owner.
- Sharing shows a success toast "Shared with N Friend(s)" (N is the number of friends selected), and the toast disappears on its own.
- Sharing is blocked with a warning toast while offline.
- Shared list supports pull-to-refresh and reloads on entry.

### Step 3: Save copies and manage access
- Recipients can save a shared order to their own orders (restaurant matched by name, otherwise a new user-created one); the copy is independent.
- On the order detail view, the "Shared with" section is a collapsible panel (`ion-accordion`, collapsed by default) whose header shows the label, a count pill, and a chevron; expanding it lists the friends with Unshare buttons.
- Unshare and save outcomes appear as temporary toasts (success, or danger on errors).
- The order list shows a "Shared" pill on orders shared with anyone, and the restaurant list shows a "Shared" pill on restaurants with any shared order; otherwise no pill. Pills update after sharing or unsharing.
- Removing a friend revokes their access to shared orders; saved copies remain.

Done when the full friend-share lifecycle (share, save, unshare, unfriend) works.

#### Tests
- Saving a shared order under a matching restaurant name uses the existing restaurant.
- Saving with no match creates a new user-created restaurant.
- The saved copy is independent of later owner edits or deletion.
- The "Shared with" panel is collapsed by default; its header shows the friend count pill and a chevron that reflects open or closed.
- Expanding the panel shows the friends the order is shared with, each with an Unshare button.
- Unsharing removes the order from that friend's Shared tab, updates the count pill, and shows a success toast.
- Saving a shared order shows a success toast; failures show a danger toast.
- The order list shows a "Shared" pill on a shared order and no pill on an unshared order.
- The restaurant list shows a "Shared" pill when any order beneath it is shared, and no pill otherwise.
- The pills clear after the last friend is unshared.
- Unfriending removes shared orders from the ex-friend's Shared tab; saved copies remain.

### Step 4: Push notifications
- Push notifications for incoming friend requests, accepted requests, and received orders.
- Handle notification permission being denied without breaking other flows.

Done when each of those events notifies the relevant user.

#### Tests
- A friend request triggers a push notification to the recipient.
- Accepting a request notifies the sender.
- Receiving a shared order notifies the recipient.
- Denied notification permission does not break friends or sharing flows.

### Step 5: Share links (core)
- Owner generates a link with an owner-chosen expiry (or none) from the sharing-options modal.
- Opening the link in the app (after sign-in or sign-up) grants read-only access and adds the order to the opener's Shared tab; openers can save it.
- Owner can see who opened the link and disable the link entirely.
- Expired or disabled links show a no-longer-valid message.

Done when a non-friend can open a link and view and save the order, and the owner can disable it.

#### Tests
- The owner can generate a link with an expiry or no expiry.
- A signed-in non-friend opening the link gets read-only access and the order appears in their Shared tab.
- A signed-out user is asked to sign in or sign up, then the link resumes.
- An opener can save the order to their own orders.
- The link is reusable by multiple openers, and the owner sees all of them.
- Opening an expired or disabled link shows a no-longer-valid message.

### Step 6: Share link friend flow and access control
- Non-friend openers are prompted to become friends; accepting sends a friend request, and no prompt is shown to existing friends.
- If the owner declines, the order is removed from the opener's Shared tab; if the opener skips the prompt, it stays.
- Owner can remove individual openers, including non-friends.
- Unfriending a link opener who became a friend revokes their access.

Done when all friend-prompt and revoke outcomes behave as specified.

#### Tests
- A non-friend opener sees the friend prompt; an existing friend does not.
- Accepting the prompt sends a friend request to the owner.
- If the owner declines, the order is removed from the opener's Shared tab.
- If the opener skips the prompt, the order stays.
- The owner can remove an individual opener, including a non-friend.
- Unfriending an opener who became a friend revokes their access.

### Step 7: Link handoff for users without the app, and offline polish
- Opening a link without the app directs the user to the app store or PWA, and the link resumes after install and sign-in.
- Shared orders are viewable offline (read-only) from cached data.
- Verify refresh failure and offline behavior across the friends and Shared lists.

Done when the open-link-without-app path works and offline and error behavior is consistent.

#### Tests
- Opening a link without the app directs to the app store or PWA, and the link resumes after install and sign-in.
- Shared orders are viewable offline and read-only.
- A failed refresh keeps previous content and shows an error on the friends and Shared lists.
- An offline refresh keeps cached data and shows a connection-needed message.

## Implementation Status

Tracks progress of each implementation step. Update the status, date, and notes as work proceeds.

Status values: Not started, In progress, In review, Done, Blocked.

| Step | Title | Status | Tests passing | Notes |
|------|-------|--------|---------------|-------|
| 1 | Friends | In review | Yes | Friends is a primary tab (`/tabs/friends`); search is exact email/phone only (2026-11-24) |
| 2 | Share an order with friends and browse the Shared tab | In review | Yes | Share button opens a sharing-options `ion-modal` with the multi-select friend picker; Shared tab (`/tabs/shared`) groups by restaurant or person, read-only detail at `/tabs/shared/:shareId`; share outcomes are `ion-toast` messages (success "Shared with N Friend(s)", warning offline, danger errors) (2026-11-25) |
| 3 | Save copies and manage access | In review | Yes | Save copy matches the recipient's own then admin restaurant by exact name, else creates one; collapsible "Shared with" `ion-accordion` (collapsed by default) with count pill and Unshare; unshare/save toasts; API returns `shared` on restaurant list and restaurant orders for "Shared" pills; unfriending removes shares both ways (2026-11-25) |
| 4 | Push notifications | Not started | No | |
| 5 | Share links (core) | In review | Yes | "Share via link" in the sharing-options modal (expiry 1/7/30 days or none); `/link/:token` opens the link (remembered through sign-in/sign-up) and adds it to the Shared tab via `order_shares.link_id`; owner sees openers and can disable a link (which also removes access gained through it); expired/disabled links show "This link is no longer valid" (2026-11-25) |
| 6 | Share link friend flow and access control | In review | Yes | Non-friend openers (no existing friendship or pending request) get an `ion-alert` friend prompt; owner declining removes link-shared orders from the opener; owner can remove individual openers (they cannot reopen the link); unfriending revokes link access (2026-11-25) |
| 7 | Link handoff for users without the app, and offline polish | Not started | No | |
