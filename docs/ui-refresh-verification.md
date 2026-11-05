# Daily inventory UI refresh — November 5, 2026

The phone dashboard now starts with Scan, Find a product, Move inventory, and Physical count. Repeated SKU totals and empty notification panels are removed. Inventory search remains visible above phone and desktop lists, with scanning alongside it. Row actions use labeled Move and More buttons; the latter exposes product management only to administrators. Text uses normal casing, larger labels, and generous touch targets.

Transfers present source, destination, available units, quantity, and a plain-language confirmation. The form awaits the actual transaction, prevents repeat submission while saving, retains errors, and displays balances returned from the successful transaction. It does not calculate the success balances from a stale screen snapshot. The existing transfer rules and validation are unchanged.

Count submission explicitly says inventory is unchanged while awaiting approval. Recent counts display pending, approved, or rejected status and the effect on inventory. Approved status was checked after an actual local administrator approval.

## Verification

- TypeScript validation, 9 unit tests, production build, and npm audit passed (zero vulnerabilities).
- 17 Firebase integration tests passed against demo-digitgit; the employee transfer test now asserts the exact committed balances returned for the success screen.
- Browser checks at 390 × 844 and 1280 × 900: task dashboard; no empty notifications; search by location; staff transfer of 5 units from a 20-unit source resulting in 15/5; staff More menu without edit/duplicate/delete; administrator More menu with those controls; count of 14 against 15 pending without posting, followed by administrator approval and approved status.
- More dialog keyboard focus wraps within the dialog; Escape closes it and restores the trigger. Transfer and More dialogs share the same focus-management hook.
- All browser writes used the local demo database. No hosted inventory records or database rules changed.
- Existing smartphone camera decoding was preserved; physical-phone camera operation was not retested.

Local screenshots are intentionally excluded from Git: ui-phone-home.png, ui-desktop-inventory.png, ui-transfer-success.png, ui-count-pending.png.
