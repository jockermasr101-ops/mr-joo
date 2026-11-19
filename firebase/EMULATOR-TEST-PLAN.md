# Emulator test plan (must pass before deployment)

1. Anonymous caller cannot invoke order, transfer, review or support callables.
2. A `client` cannot create an order with a browser-supplied price/title; function accepts only product IDs and quantities.
3. Inactive/missing products, duplicate product IDs, invalid quantities and totals above the configured limit are rejected.
4. A customer cannot create a transfer for another user's order or use a receipt path outside `receipts/{theirUid}/{orderId}/`.
5. Duplicate transfer references are rejected.
6. Receipt upload rejects oversized files and disallowed MIME metadata; separately test real file-signature scanning in the backend pipeline.
7. A `client`, `support`, `orders` or ordinary `staff` role cannot approve a transfer.
8. An `accountant`, `admin` or `owner` can approve/reject a pending transfer; a second review attempt fails.
9. Approval writes one ledger entry and marks the order paid atomically. Receipt submission alone never writes the ledger.
10. A customer cannot read another customer's order, transfer, ledger entry, support shell or support messages.
11. Support messages are append-only; customers cannot forge staff roles or update/delete old messages.
12. A staff member cannot mutate order totals, payment status, transfer status or ledger documents directly through Firestore.
13. Public registration cannot assign privileged roles or overwrite wallet/permissions fields.
14. Test all list queries against rules; Firestore rules are not filters.

Use the Firebase Emulator Suite and `@firebase/rules-unit-testing` for automated Rules tests. This repository does not claim these tests have already been executed against a live Firebase project.
