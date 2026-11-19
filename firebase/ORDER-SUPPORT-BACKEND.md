# MR JOO — Order, payment review & support backend

This phase adds Firebase Cloud Functions (Node.js 20) source code. It is **not deployed** and does not become active until a Firebase project is configured, dependencies are installed, App Check is configured, and emulator tests pass.

## Callable functions

- `createOrder({ items: [{ productId, quantity }] })`: reads active products and prices from `products/{productId}` on the server. Browser-supplied prices/titles are ignored.
- `submitTransfer({ orderId, receiptPath, reference })`: checks ownership, order amount, receipt path and duplicate transfer reference; creates a pending transfer. It does not credit a wallet.
- `reviewTransfer({ transferId, decision: 'approve'|'reject', note })`: owner/admin/accountant only. Approval atomically marks the order paid and creates exactly one ledger document `transfer_{transferId}`.
- `sendSupportMessage({ conversationUid, text })`: creates append-only messages for the customer or authorized support staff.
- `healthCheck()`: authenticated deployment smoke test.

## Required Firestore documents

`products/{productId}` (admin-managed):

```js
{ title: 'Logo design', price: 1500, active: true, updatedAt: serverTimestamp() }
```

`users/{uid}` role must be provisioned by a trusted Admin SDK process. Supported roles in this phase: `owner`, `admin`, `staff`, `orders`, `accountant`, `support`, `client`. Never let public registration choose a privileged role.

`orders/{orderId}` and `transfers/{transferId}` are server-managed. `ledger/{entryId}` is append-only from the application's point of view. Admin SDK bypasses Security Rules, so all checks in Functions remain mandatory.

Support data uses `support/{uid}` and `support/{uid}/messages/{messageId}`. Do not restore a mutable `msgs` array.

## Deploy preparation

1. Create a Firebase project and copy `.firebaserc.example` to `.firebaserc`; replace the project ID.
2. Install Firebase CLI and run `npm install` inside `functions/`.
3. Enable Authentication providers and configure App Check for the web app. These callables enforce App Check.
4. Configure Storage upload from the signed-in client to `receipts/{uid}/{orderId}/{filename}`. Only image/jpeg, image/png, image/webp, and PDF up to 5 MB are accepted by Storage rules. Validate actual file signatures and scan uploads in a trusted backend before operational use; MIME metadata alone is spoofable.
5. Seed test products and create the first owner with a trusted Admin SDK script run in a secure environment. Never create the first owner from a browser page.
6. Start emulators and test every role and denial case. Only then deploy rules and functions.

## Client integration contract

Use Firebase Web SDK modular `httpsCallable(functions, 'createOrder')`, `submitTransfer`, `reviewTransfer`, and `sendSupportMessage`. Do not write orders, transfers, payment status, ledger entries, or privileged support messages directly from browser code. Upload the receipt first, then pass its exact Storage path to `submitTransfer`.

## Important limitations / production hardening

- This is a secure starting implementation, not an independent penetration test or guarantee against compromise.
- `createOrder` currently supports fixed-price products and quantities only; service-specific custom quotes, discounts, tax, stock reservation and refunds need explicit business rules before enabling them.
- `reviewTransfer` verifies the submitted transfer against the order total, but an accountant must independently verify the actual bank/mobile-wallet transaction before approving it.
- Add audit logs, alerting, rate limits/abuse controls, upload malware scanning, retention policy, backups and monitoring before production.
- Add Firestore composite indexes if the app's future queries require them.
- The app must not display a paid badge or increase wallet balance based on receipt upload. Only the server approval flow changes payment state.
