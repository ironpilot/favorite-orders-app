# Features: Favorite Order App

Core product features extracted from `spec.md`, kept high level and product-focused.

## 1. Account Creation and Sign Up

**Description:** A simple account creation and sign-up experience so people can start using the app and keep their favorite orders under their own account.

**User flow:**
1. User opens the app and sees only sign-in or sign-up; nothing else is reachable until authentication succeeds.
2. User creates an account or signs in.
3. User lands on the restaurant list.
4. On later launches the stored session is restored. An expired access token (1 hour) is silently refreshed with the refresh token (2 weeks); if both have expired, the user signs in again.

**UI overview:**
- A simple, phone-friendly sign-up screen.
- After sign-up, the user sees the restaurant list.
- A persistent "Operating offline" banner while a signed-in user is offline; the app keeps working with cached data. On reconnect, or on resume from the background, the session is re-checked (refresh or sign-in prompt) and the banner clears.

## 2. Restaurant List

**Description:** Users see a list of the restaurants where they have recorded favorite orders. Restaurants are either administrator-owned (pre-populated) or entered manually by the user, and a user-created restaurant stays in the list (as an empty entry) until the user removes it. Shared orders from friends are not shown here; they live in the separate Shared tab.

**User flow:**
1. User opens the app.
2. User sees the list of restaurants with recorded favorite orders.
3. User can search by restaurant or item name, or sort (most recently updated first by default, or A–Z).
4. User selects a restaurant to see its orders.
5. User can remove a restaurant (confirmation required if it still has orders).

**UI overview:**
- List or card view showing each restaurant name, its order count, and the items of its default order.
- A restaurant with no orders shows its name and a prompt to add an order.
- A search field (matches restaurant and item names) and a sort option.
- An empty state pointing new users to add their first order.
- Designed for up to roughly 100 restaurants; restaurants with different spellings are kept as separate entries.
- A prominent "add order" button, disabled with an explanatory message when offline.
- Navigation suited to one-handed phone use, such as bottom tabs or a menu.

## 3. Manage Favorite Orders

**Description:** Users can add, update, and remove favorite orders at each restaurant. Orders are sub-items of a restaurant: each restaurant can have multiple orders, and each order can be modified individually without changing the restaurant. An order has a list of items (at least one), each with a quantity (default 1) and optional customizations (removals, additions, substitutions, e.g. a Hamburger with No Lettuce, add Onions, Mayonnaise instead of Ketchup), plus an optional name and notes. Orders are private until shared and cannot be moved to another restaurant in v1; user-created restaurants can be renamed. Restaurants are administrator-owned (pre-populated, available to all users, not editable by users) or user-created (private to the creator). Restaurant names and common toppings auto-fill as the user types. There is no order history or versioning at this time. For each restaurant, the user can mark one order as the default, which is used for the preview on the restaurant list.

**User flows:**

*Add a favorite order*
1. User opens the app and taps add.
2. User types a restaurant name and picks an auto-fill suggestion (administrator-owned or their own) or keeps the typed name to create a new one, then adds items (quantity defaults to 1) and customizes each item.
3. User saves.

*Manage orders at a restaurant*
1. User opens a restaurant.
2. User adds, updates, or removes an order.
3. User saves.

**UI overview:**
- A prominent add button.
- A restaurant field with auto-fill that also allows creating a new restaurant by typing a name. There is no "Add a restaurant" button.
- An order form with a list of items, a quantity per item (default 1), per-item customizations (remove, add, substitute) with common-toppings auto-fill (free text still allowed), and notes.
- A way to mark one order at a restaurant as the default.
- A simple order detail view with a share action.

## 4. Friends

**Description:** Users connect with friends and family through friend requests. Orders can be shared directly only with accepted friends (share links are the exception, see feature 5).

**User flow (add a friend):**
1. User opens friends.
2. User searches by email or phone (not by name).
3. User sends a friend request (the sender can cancel it while pending).
4. The other person accepts or declines. A declined request is silently removed.
5. Both can now share orders with each other.

Users can also remove a friend, which revokes that person's access to orders shared with them (copies they already saved remain). Users get push notifications for incoming friend requests and acceptances.

**UI overview:**
- A Friends primary tab in the bottom tab bar, with a search field.
- Friend requests that can be sent, cancelled, accepted, or declined, and a way to remove a friend.

## 5. Share an Order with Another User (Primary Feature)

**Description:** Users share a favorite order with friends in the app, or via a link. Recipients can view it (read-only, always the owner's latest version) and save it to their own orders (matched to a restaurant by name, or a new user-created one), and are notified by push when it arrives. Owners can unshare at any time.

**User flow:**
1. User opens an order.
2. User taps share.
3. User selects one or more friends (already-shared friends are marked) or generates a share link.
4. The order appears in each friend's shared orders, and each friend is notified.

**Share link flow:**
1. Owner generates a link, choosing an expiry (or none).
2. Anyone signed in who opens it gets read-only access, and can save the order. Without the app, they are sent to the app store or PWA, and the link resumes afterwards.
3. Non-friends are prompted to become friends with the owner; accepting sends a friend request. If the owner declines, the order is removed from the opener's Shared tab; if the opener skips the prompt, it stays.
4. The owner sees who opened the link and can disable the link or remove individual openers. Expired or disabled links show a no-longer-valid message.

**UI overview:**
- A share action on the order detail view.
- A friend picker with multi-select, and a share link option.
- A push notification for the recipient.
- An owner view of who has access, with unshare/revoke controls.

## 6. Browse Shared Orders

**Description:** Users view the orders that friends and family have shared with them.

**User flow:**
1. User opens the feed.
2. User selects a restaurant or person.
3. User views the order details.

**UI overview:**
- A feed of shared orders, organized by restaurant or person.
- A detail view for each order.
- Shared orders can be viewed offline (read-only).

## 7. Text an Order

**Description:** Users text an order to a friend with a single button click.

**User flow:**
1. User opens an order.
2. User taps the text button.
3. User chooses a contact.
4. The message is prepared and sent.

**UI overview:**
- A text button on the order detail view.
- A contact chooser.
- A prepared message ready to send.
