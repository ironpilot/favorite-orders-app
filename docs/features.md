# Features: Favorite Order App

Core product features extracted from `spec.md`, kept high level and product-focused.

## 1. Account Creation and Sign Up

**Description:** A simple account creation and sign-up experience so people can start using the app and keep their favorite orders under their own account.

**User flow:**
1. User opens the app.
2. User creates an account.
3. User lands on the restaurant list.

**UI overview:**
- A simple, phone-friendly sign-up screen.
- After sign-up, the user sees the restaurant list.

## 2. Restaurant List

**Description:** Users see a list of the restaurants where they have recorded favorite orders. Restaurants are entered manually by the user, and a restaurant stays in the list (as an empty entry) until the user removes it. Shared orders from friends are not shown here; they live in the separate Shared tab.

**User flow:**
1. User opens the app.
2. User sees the list of restaurants with recorded favorite orders.
3. User can search by restaurant name or sort (most recently updated first by default, or A–Z).
4. User selects a restaurant to see its orders.
5. User can remove a restaurant (confirmation required if it still has orders).

**UI overview:**
- List or card view showing each restaurant name, its order count, and the items of its default order.
- A restaurant with no orders shows its name and a prompt to add an order.
- A search field and a sort option.
- An empty state pointing new users to add their first order.
- Designed for up to roughly 100 restaurants; restaurants with different spellings are kept as separate entries.
- A prominent "add order" button, disabled with an explanatory message when offline.
- Navigation suited to one-handed phone use, such as bottom tabs or a menu.

## 3. Manage Favorite Orders

**Description:** Users can add, update, and remove favorite orders at each restaurant. Orders are sub-items of a restaurant: each restaurant can have multiple orders, and each order can be modified individually without changing the restaurant. An order has a list of items, each with a quantity (default 1) and optional customizations (removals, additions, substitutions, e.g. a Hamburger with No Lettuce, add Onions, Mayonnaise instead of Ketchup), plus notes. Orders are private until shared. For each restaurant, the user can mark one order as the default, which is used for the preview on the restaurant list.

**User flows:**

*Add a favorite order*
1. User opens the app and taps add.
2. User selects an existing restaurant or creates a new one, then adds items (quantity defaults to 1) and customizes each item.
3. User saves.

*Manage orders at a restaurant*
1. User opens a restaurant.
2. User adds, updates, or removes an order.
3. User saves.

**UI overview:**
- A prominent add button.
- A restaurant picker that also allows creating a new restaurant.
- An order form with a list of items, a quantity per item (default 1), per-item customizations (remove, add, substitute), and notes.
- A way to mark one order at a restaurant as the default.
- A simple order detail view with a share action.

## 4. Friends

**Description:** Users connect with friends and family through friend requests. Orders can only be shared with accepted friends.

**User flow (add a friend):**
1. User opens friends.
2. User searches by name, email, or phone.
3. User sends a friend request.
4. The other person accepts.
5. Both can now share orders with each other.

**UI overview:**
- A friends screen with a search field.
- Friend requests that can be sent and accepted.

## 5. Share an Order with Another User (Primary Feature)

**Description:** Users share a favorite order directly with a friend in the app. The friend can view it and save it to their own orders, and is notified when it arrives.

**User flow:**
1. User opens an order.
2. User taps share.
3. User selects a friend.
4. The order appears in the friend's shared orders, and the friend is notified.

**UI overview:**
- A share action on the order detail view.
- A friend picker.
- A notification for the recipient.

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
