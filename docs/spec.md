# Project Specification: Favorite Order App

## Summary
Favorite Order App is a mobile-first app for sharing our favorite restaurant orders with friends and family. Users can save the orders they love at their favorite restaurants and share them so others know exactly what to get. The app is designed with Ionic.

## Goals
- Make it easy to record a favorite order at a restaurant.
- Let friends and family browse and discover each other's favorite orders.
- Provide a fast, touch-friendly experience on mobile devices first, with graceful scaling to larger screens.

## Requirements
### Functional Requirements
- Create, edit, and delete a favorite restaurant order (restaurant, items, customizations, notes).
- Orders are sub-items of restaurants: each restaurant can have multiple orders, and each order can be modified individually without changing the restaurant.
- When adding an order, the user selects an existing restaurant (administrator-owned or their own) or creates a new restaurant at that time.
- Restaurants are either administrator-owned or user-created. Administrator-owned restaurants are pre-populated, available to all users, and not editable (renamed or removed) by users. User-created restaurants are visible only to their creator.
- The restaurant field in the add-order flow auto-fills as the user types, suggesting administrator-owned and the user's own restaurants. Typing a name without picking a suggestion creates a new user-created restaurant.
- The customization field (remove, add, substitute) auto-fills from an administrator-maintained list of common toppings; free text is still allowed.
- Each order has a list of order items, each with a quantity (default 1).
- Each order item can be customized with removals, additions, and substitutions (for example, a Hamburger with No Lettuce, add Onions, Mayonnaise instead of Ketchup).
- Share orders with friends and family.
- Browse and view orders shared by others.
- See a list of restaurants that we have recorded favorite orders at.
- Restaurant list shows each restaurant's name, order count, and the items of its default order; it can be searched by restaurant name or item name and sorted (most recently updated first by default, or A–Z).
- Restaurants stay in the list as empty entries when their last order is removed, until the user removes them; removing a restaurant with orders requires confirmation.
- Users can mark one order per restaurant as its default order. A lone order is the default; if the default is deleted, the most recently updated remaining order becomes the default.
- An order has an optional name and must have at least one item; item quantity is at least 1 with no upper limit.
- Users can rename a restaurant they created (its orders stay attached); administrator-owned restaurants cannot be renamed. Orders cannot be moved to another restaurant in v1.
- Restaurants are created only while adding an order. There is no "Add a restaurant" button anywhere in the app.
- No order history or versioning at this time; only the last-updated time is kept.
- Shared orders from friends appear in a separate Shared tab, not in the restaurant list.
- Add, remove, and update the favorite orders at each restaurant.
- Text our order to a friend from a single button click.
- Account creation and user sign-up experience.
- Share an order with another user in the app (primary feature).
- Friends system: users send and accept friend requests; orders can only be shared with accepted friends.
- Orders are private by default and visible only to the owner until shared.
- User-created restaurants are entered manually by the user (no external places lookup).
- Administrator-owned restaurants and the common toppings list are managed by the administrator, outside the user-facing app.

### Non-Functional Requirements
- Mobile-first design: layouts and interactions are designed for phones first.
- Built with Ionic components for a consistent, native-feeling UI.
- Responsive, with acceptable layout on tablet and desktop.
- Fast load times and smooth navigation.
- Offline support: saved and shared orders are cached and viewable offline (read-only); creating, editing, deleting, and sharing require a connection.
- Platforms: iOS, Android, and a PWA.
- While offline, the "add order" button is disabled with a message explaining a connection is needed.
- The restaurant list is sized for up to roughly 100 restaurants; no special large-list handling.

## Features
- **Share an Order with Another User (Primary Feature)**: Share a favorite order directly with another user in the app so they can view it and save it to their own orders.
- **Restaurant List**: See a list of restaurants that we have recorded favorite orders at, with order count, default-order preview, search and sort.
- **Manage Favorite Orders**: Add, remove, and update the favorite orders at each restaurant, and mark one as the default.
- **Text an Order**: Text our order to a friend from a single button click.
- **Account Creation and Sign Up**: A simple account creation and user sign-up experience.

## Constraints
- Must use Ionic as the UI framework.
- Must be designed mobile first.
- Must use Vue with Ionic Vue.
- Must use a Node.js server with a SQLite database as the backend.
- No third-party places/restaurant API.
- No "Add a restaurant" buttons; restaurants are only added when a user creates an order.
- No order history or versioning at this time.
- Sharing is limited to accepted friends.

## User Flows
- View restaurants: open app -> see list of restaurants with order counts and default-order previews -> search or sort -> select a restaurant to see its orders.
- Remove a restaurant: open restaurant list -> remove a restaurant -> confirm if it still has orders.
- Manage orders at a restaurant: open restaurant -> add, update, or remove an order -> save.
- Text an order: open an order -> tap the text button -> choose a contact -> message is prepared and sent.
- Sign up: open app -> create account -> land on restaurant list.
- Add a favorite order: open app -> tap add -> type a restaurant and pick an auto-fill suggestion (administrator-owned or own) or keep the typed name as a new one -> add order items (quantity defaults to 1) and customize each item (remove, add, substitute, with common-toppings auto-fill) -> save.
- Share an order: open an order -> tap share -> choose friends/family or a share link.
- Share an order with another app user: open an order -> tap share -> select a friend -> order appears in their shared orders and they are notified.
- Add a friend: open friends -> search by name, email, or phone -> send request -> they accept -> they can now share orders with each other.
- Browse shared orders: open feed -> select a restaurant or person -> view order details.

## Technical Decisions
- UI framework: Ionic (mobile-first components and navigation).
- Frontend: Vue (Ionic Vue) with TypeScript.
- Native layer: Capacitor for iOS and Android builds, plus a PWA.
- Backend: Node.js HTTP/JSON API server (`server/`) using the built-in `node:http` and `node:sqlite` modules (Node 22.13+), with no external runtime dependencies.
- Database: a single SQLite file (default `server/data/app.db`, configurable via `DATABASE_PATH`) with tables for users, sessions, restaurants (administrator-owned with no user owner, or user-created), orders (belonging to a restaurant), order items (belonging to an order, with a quantity defaulting to 1), order item customizations (remove, add, or substitute), a common toppings list, friendships, and order shares.
- Auth: email/password accounts with scrypt-hashed passwords; sign-in returns a bearer token stored by the client and sent in the `Authorization` header.
- Access control: enforced in the API so users only see administrator-owned restaurants, their own restaurants and orders, plus orders shared with them by accepted friends; shared orders are read-only for recipients. Users cannot rename or remove administrator-owned restaurants.
- Client configuration: the app reaches the API at `VITE_API_URL` (default `http://localhost:3000`).
- Privacy: orders are private by default; sharing creates an explicit share record.
- Friends: a friends table with pending/accepted status gates sharing.
- Restaurants: administrator-owned (pre-populated) or user-created free-text entries, with no external API; the add-order field auto-fills from both. Different spellings are kept as separate entries (a user-created restaurant may share a name with an administrator-owned one) and restaurants persist independently of their orders.
- Toppings: an administrator-maintained list of common toppings served to the client for customization auto-fill; suggestions only, free text allowed.
- Offline: read-only local cache of saved and shared orders; writes require connectivity.
- Text an order: native SMS composer via the `sms:` scheme or Capacitor.

## UI/UX Overview
- Bottom tab or menu navigation suited to one-handed mobile use.
- List/card views of restaurants with name, order count, and default-order items; empty restaurants show a prompt to add an order.
- Search field and sort option on the restaurant list.
- Tabs include a separate Shared tab for orders from friends.
- Prominent "add order" action button; no "Add a restaurant" button.
- Restaurant auto-fill in the add-order form and common-toppings auto-fill on item customizations.
- Simple order detail view with a share action.
