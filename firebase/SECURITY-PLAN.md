# Firebase security implementation plan

This repository intentionally starts with deny-all Firestore and Storage rules.
Do not loosen these rules just to make the UI appear functional.

Before enabling customer data:
1. Define collections and document ownership (`users/{uid}`, `orders/{orderId}`, `products/{productId}`, `conversations/{id}`, `ledger/{entryId}`).
2. Use Firebase Authentication; verify email and apply MFA for owner/admin accounts where practical.
3. Store staff roles in trusted custom claims set only by a privileged Admin SDK environment (Cloud Functions/server), never in a client-editable profile field.
4. Validate every field, type, allowed state transition, amount and ownership in rules and/or callable Cloud Functions.
5. Create orders and ledger entries server-side. A client-submitted payment receipt must never credit a wallet automatically.
6. Keep immutable ledger records; corrections should be compensating entries, not edits.
7. Upload files to private paths with strict size/type limits; scan risky uploads server-side before making them available.
8. Add App Check, rate limits/abuse controls, audit logs, backups and alerting.
9. Test rules with Firebase Emulator Suite and a negative test suite before production.
10. Keep service-account keys and Cloudinary API secret only in server-side environment variables.

The current HTML pages are visual prototypes, not authenticated or production-safe account/admin functionality.
