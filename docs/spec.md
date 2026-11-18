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
- Share orders with friends and family.
- Browse and view orders shared by others.
- See a list of restaurants that we have recorded favorite orders at.
- Restaurant list shows each restaurant's name, order count, and the items of its default order; it can be searched by restaurant name and sorted (most recently updated first by default, or A–Z).
- Restaurants stay in the list as empty entries when their last order is removed, until the user removes them; removing a restaurant with orders requires confirmation.
- Users can mark one order per restaurant as its default order.
- Shared orders from friends appear in a separate Shared tab, not in the restaurant list.
- Add, remove, and update the favorite orders at each restaurant.
- Text our order to a friend from a single button click.
- Account creation and user sign-up experience.
- Share an order with another user in the app (primary feature).
- Friends system: users send and accept friend requests; orders can only be shared with accepted friends.
- Orders are private by default and visible only to the owner until shared.
- Restaurants are entered manually by the user (no external places lookup).

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
- Must use Supabase as the backend.
- No third-party places/restaurant API.
- Sharing is limited to accepted friends.

## User Flows
- View restaurants: open app -> see list of restaurants with order counts and default-order previews -> search or sort -> select a restaurant to see its orders.
- Remove a restaurant: open restaurant list -> remove a restaurant -> confirm if it still has orders.
- Manage orders at a restaurant: open restaurant -> add, update, or remove an order -> save.
- Text an order: open an order -> tap the text button -> choose a contact -> message is prepared and sent.
- Sign up: open app -> create account -> land on restaurant list.
- Add a favorite order: open app -> tap add -> enter restaurant and order details -> save.
- Share an order: open an order -> tap share -> choose friends/family or a share link.
- Share an order with another app user: open an order -> tap share -> select a friend -> order appears in their shared orders and they are notified.
- Add a friend: open friends -> search by name, email, or phone -> send request -> they accept -> they can now share orders with each other.
- Browse shared orders: open feed -> select a restaurant or person -> view order details.

## Technical Decisions
- UI framework: Ionic (mobile-first components and navigation).
- Frontend: Vue (Ionic Vue) with TypeScript.
- Native layer: Capacitor for iOS and Android builds, plus a PWA.
- Backend: Supabase (Postgres, Auth, Realtime), with row-level security so users only see their own orders and orders shared with them by friends.
- Privacy: orders are private by default; sharing creates an explicit share record.
- Friends: a friends table with pending/accepted status gates sharing.
- Restaurants: free-text entry by users, with no external API; different spellings are kept as separate entries and restaurants persist independently of their orders.
- Offline: read-only local cache of saved and shared orders; writes require connectivity.
- Text an order: native SMS composer via the `sms:` scheme or Capacitor.

## UI/UX Overview
- Bottom tab or menu navigation suited to one-handed mobile use.
- List/card views of restaurants with name, order count, and default-order items; empty restaurants show a prompt to add an order.
- Search field and sort option on the restaurant list.
- Tabs include a separate Shared tab for orders from friends.
- Prominent "add order" action button.
- Simple order detail view with a share action.
