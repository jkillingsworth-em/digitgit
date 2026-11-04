# Inventory workflow verification

This branch combines PR #25's App.tsx changes with the dependency upgrade
and code-check fixes in PRs #26 and #27. It is a review branch; no PRs have
been merged and no Firestore rules have been deployed by this work.

## Fixes

- Imports and quantity audits use transactions, reject ambiguous duplicate
  stock records and stale displayed quantities, and preserve legacy stock
  document paths. The imported quantity remains an absolute quantity rather
  than a receipt increment, consistent with the existing import behavior.
- Bulk SKU changes reject occupied destinations and migrate item/stock data
  together. Renamed stock now also receives the correct stored document ID,
  preserving receipt and location metadata.
- Import / Export now offers both choices, as requested. The existing import
  modal was unreachable; the export callback was empty. Smart export now
  downloads the chosen fields and correctly escapes CSV quotes.
- Cycle-count submission/review errors appear on screen. Approval checks
  the full relevant line contents against the reviewed snapshot, so editing
  a count without changing its number of lines invalidates the review.

## Observed local browser results

These checks used only the demo-digitgit Auth/Firestore emulators and the
repository's current security rules.

| Workflow | Database and browser result |
| --- | --- |
| Submit count: book 20, counted 18 | Count saved pending/unposted; stock stayed 20 |
| Approve count | Status approved/posted; stock became 18 |
| Submit another count, then change stock to 19 | Approval rejected; stock stayed 19 and the count stayed pending |
| Retry stale approval after UI fix | Screen displayed `Quantity changed for TEST-LED. Recount or resubmit before approval.` |
| Reject stale count | Status rejected; stock unchanged |
| CSV import | IMPORT-LED created with 8 at test-a and 3 at test-b |
| Rename IMPORT-LED to occupied TEST-LED | Refused; neither product's stock was overwritten |
| Rename to unused RENAMED-LED | Original SKU removed; 8/3 preserved |
| Retest metadata fix by renaming to FINAL-LED | Destination document paths and stored docId matched FINAL-LED_test-a / FINAL-LED_test-b; 8/3 preserved |
| Generate Smart CSV | Downloaded inventory_export.csv contained FINAL-LED 8/3 and TEST-LED 19, with category included |

The test fixture CSV has columns ID, DESCRIPTION, CATEGORY, LOCATION,
SOURCE, QTY, with two rows for IMPORT-LED at test-a/test-b (8/3). Fixtures
can be generated locally; no real inventory file is required.

## Automated checks and limits

`npm test` runs seven regression checks for count snapshot changes, CSV
field selection/escaping and renamed-stock identity/metadata. The five
Firebase emulator tests include employee count creation and denial of
employee approval, stock edits and submission under another identity.
Typecheck, build and audit pass; the existing bundle-size warning remains.

The browser upload/download controls were unreliable and caused long delays.
Both operations completed, and the imported records and downloaded CSV were
also checked directly.

These results cover the stated single-session flows. They do not prove the
absence of all races: stock-document discovery happens before transactions,
and concurrent creation of additional legacy records is not covered. Full
multi-user import/rename tests, hosted Google authentication, barcode and
printing hardware, and live Sheets synchronization remain unverified.
