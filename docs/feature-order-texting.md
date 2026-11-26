# Text an Order

## Summary
Text an Order lets a user send one of their favorite orders to a friend as a text message with a single button click, so the friend knows exactly what to get. The user opens an order, taps the text button, chooses a contact, and a message describing the order is prepared and handed to the device's text composer.

## Goals
- Make it quick and effortless to tell someone what to order, from the order itself.
- Reach people through a plain text message, including people who are not using the app.
- Fit naturally into the existing order detail experience on a phone.
- Keep the user's orders private except for what the user chooses to send.

## Requirements
### Functional Requirements
1. **Entry point:** The order detail view shows a text button for the order being viewed. Text an Order is available for any order the user can open, from a single tap.
2. **Contact choice:** After tapping the text button, the user picks a contact with the operating system's contact picker (CapacitorJS contacts plugin), which returns only the chosen contact and its phone number. The app never reads the full contact list. On the PWA, where no picker exists, the user types a phone number or copies the message.
3. **Message preparation:** The app prepares a plain, readable message that describes the order, ready to send. The message includes the restaurant name, the order name (if any), each order item with its quantity, and each item's customizations (removals, additions, substitutions). The message contains no app link. Very long messages are left to the device to handle.
4. **Notes choice:** The user chooses whether to include the order notes in the message before sending.
5. **Sending:** The prepared message is shown in the device's native text composer, where the user reviews it and presses send. The app cannot confirm delivery. The flow is: open an order, tap the text button, choose a contact, and the message is prepared and handed to the composer.
6. **No text capability and copy:** Where the device has no text handler (for example a desktop browser), the user can copy the message to the clipboard instead. A "Copy order" button is also always available next to the text button, using the CapacitorJS Clipboard plugin (with the browser clipboard API as the PWA fallback).
7. **Order unchanged:** Texting an order does not change the order, its default status, its last-updated time, or its sharing state.
8. **Independent of sharing:** Texting is separate from in-app sharing and share links. It does not require the recipient to be an accepted friend in the app or to have an account, and it does not grant the recipient any access to the order in the app.
9. **Privacy:** Orders remain private by default. Only the content the user sends in the message leaves the order.
10. **Connectivity:** Texting works offline, using cached order data, because it does not change data or need the app's server.
11. **Authentication:** The feature is only reachable by a signed-in user, as with all application functionality.
12. **Messages and feedback:** Success and failure messages (for example a message that could not be prepared or sent, or the message being copied) are shown with the Ionic `ion-alert` component.
13. **Platforms and UI:** The feature works on iOS, Android, and the PWA, with a simple, phone-friendly, one-handed experience built with Ionic components.

### Assumptions and Dependencies
- Depends on Manage Favorite Orders for orders, order items, quantities, customizations, and notes (`feature-manage-orders.md`).
- Depends on the order detail view, which also hosts the share action.
- Depends on Account Creation and Sign Up for the authentication gate (`feature-account-setup.md`).
- Contacts come from the user's own device contacts, not from the app's Friends list, via the system contact picker (single contact, no bulk read).
- Requires the CapacitorJS contacts-picker plugin and `@capacitor/clipboard`.

### Edge Cases
- The user cancels out of the contact chooser or the message before sending. No message is sent and the order is unchanged.
- The user denies access to contacts or messaging. The user is told the message cannot be sent.
- The chosen contact has no phone number. The user is told and can pick another contact.
- The device cannot send text messages. Copy to clipboard is offered.
- The order is long, with many items or customizations, or has no name or notes. The message handles each case.
- The user is offline. Texting still works.

### Out of Scope
- Sending to people through channels other than text messages.
- In-app sharing, share links, and friend management (see `feature-sharing.md`).
- Message delivery tracking, history of texted orders, or receipts.

## Implementation Steps
Each step leaves the app working and is small enough to review on its own.

### Step 1: Order message builder
- Build the plain, readable message from an order: restaurant name, order name (if any), items with quantities, and each item's customizations.
- Optionally include the order notes; omit them by default until the user chooses.
- Handle orders with no name or no notes, and long orders (no truncation).
- Works from cached order data so it is usable offline.
- Review focus: message content for typical and edge-case orders.

#### Tests
- Message includes restaurant name, order name, items with quantities, and customizations.
- Order with no name omits the name line without leaving a blank or placeholder.
- Notes are included only when requested, and omitted by default.
- Order with no notes produces no notes section even when notes are requested.
- Long orders with many items are not truncated.
- Message contains no app link.
- Builder works from cached data with no network.

### Step 2: Text button and notes choice
- Add the text button to the order detail view, next to the share action.
- On tap, ask whether to include the notes (shown only if the order has notes).
- The button works offline and does not change the order.
- Review focus: placement, the notes prompt, and that the order is untouched.

#### Tests
- Text button appears on the order detail view next to the share action.
- Notes prompt appears only when the order has notes.
- Choosing to include or exclude notes is passed on to the message builder.
- Button is enabled and works while offline.
- Tapping the button does not change the order, its default status, last-updated time, or sharing state.

### Step 3: Contact choice and native composer
- After the notes choice, let the user pick any device contact.
- Open the device's native text composer with the prepared message addressed to that contact; the user reviews and sends.
- Handle cancel at the contact chooser or composer (nothing sent, order unchanged).
- Review focus: the end-to-end flow on iOS and Android.

#### Tests
- Any device contact can be chosen after the notes choice.
- Native composer opens addressed to the chosen contact with the prepared message.
- Cancelling at the contact chooser sends nothing and leaves the order unchanged.
- Cancelling in the composer sends nothing and leaves the order unchanged.
- Flow works offline.

### Step 4: Fallbacks and error handling
- Where there is no text handler (for example a desktop browser PWA), offer copy to clipboard and confirm with an `ion-alert`.
- Show `ion-alert` messages when contacts access is denied or the message cannot be prepared or sent.
- Review focus: every edge case in this spec produces a clear message and no side effects.

#### Tests
- With no text handler, the copy-to-clipboard option is offered and the copied message matches the prepared message.
- Copying shows a confirmation `ion-alert`.
- Denied contacts access shows an `ion-alert` saying the message cannot be sent.
- A message that cannot be prepared or sent shows an `ion-alert`.
- No error path changes the order or sharing state.

### Step 5: System contact picker and clipboard (CapacitorJS)
- Replace any custom contact chooser with the OS contact picker through a CapacitorJS plugin; read only the chosen contact's phone number.
- Add a "Copy order" button using `@capacitor/clipboard`, with `navigator.clipboard` as the PWA fallback; confirm with an `ion-alert`.
- Use the same Clipboard wrapper for the no-text-handler fallback in Step 4.
- Wrap both plugins in `client/src/services/native/` so the web fallbacks stay in one place.
- Review focus: no full-contact-list permission is requested; behavior on iOS, Android, and the PWA.

#### Tests
- The picker returns one contact and the composer opens addressed to its number.
- A contact with no phone number shows an `ion-alert` and nothing is sent.
- Cancelling the picker leaves the order unchanged.
- "Copy order" copies exactly the prepared message and confirms with an `ion-alert`, offline included.
- On the PWA the picker is replaced by manual number entry and the clipboard falls back to `navigator.clipboard`.

### Step 6: Polish and verification
- Confirm the feature is only reachable when signed in, works offline, and does not alter sharing state.
- Check phone-friendly, one-handed layout, and acceptable layout on tablet and desktop.
- Review focus: manual pass across iOS, Android, and the PWA against the requirements above.

#### Tests
- Signed-out users cannot reach the feature.
- Texting works offline on iOS, Android, and the PWA.
- Sharing state is unchanged after texting an order.
- Layout is usable one-handed on a phone and acceptable on tablet and desktop.
- Manual pass of the full flow on iOS, Android, and the PWA.

## Implementation Status
Update this section as work progresses. Status values: Not started, In progress, In review, Done, Blocked.

| Step | Name | Status | Notes |
|------|------|--------|-------|
| 1 | Order message builder | Not started | |
| 2 | Text button and notes choice | Not started | |
| 3 | Contact choice and native composer | Not started | |
| 4 | Fallbacks and error handling | Not started | |
| 5 | System contact picker and clipboard (CapacitorJS) | Not started | |
| 6 | Polish and verification | Not started | |
