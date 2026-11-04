# Employee and administrator permissions

| Operation | Verified employee | Administrator |
| --- | --- | --- |
| View inventory, categories and listed locations | Yes | Yes |
| Transfer units between existing locations | Yes, balanced transaction only | Yes |
| Submit physical counts | Yes, pending approval | Yes |
| Approve/reject counts or directly adjust totals | No | Yes |
| Create/edit/delete products, SKU, name or description | No | Yes |
| Change category definitions/assignments or location setup | No | Yes |
| Import or add stock | No | Yes |

Administrator access comes only from the trusted Firebase Auth `admin` custom
claim. This change does not grant an administrator role to any user. The
existing verified `electro-mech.com` employee requirement remains in place.

## Transfer enforcement

The app uses the same `transferStock` function for a standard single-product
transfer by an employee or administrator. It reads both stock records and
checks that the product and both location documents exist. It then writes
both quantities and a new `transfers` record in one transaction.

Database rules verify that the debit equals the credit, the total is preserved,
both locations are existing definitions, product identity is unchanged, and
only permitted stock fields change. Employees cannot create an independent
stock increment/decrement or replay a completed transfer. Existing stock
metadata stays protected; destination sub-location detail may be supplied as
part of the move. Legacy stock document paths are preserved.

A source record remains at quantity zero after moving all its units, allowing
rules to check both final quantities. Duplicate stock records are rejected for
administrator reconciliation. Contending moves retry only after a rejected
write and a confirmed quantity change; unchanged permission errors propagate.

The mobile footer exposes Move, Count, Scan and Search to employees. Add,
direct Audit, product editing, duplicate/delete and setup controls stay admin
only. Product details provide Move without Edit for employees. Camera access
still uses the existing phone-camera scanner; no additional scanner hardware
is introduced or required.

## Verification

The emulator suite has 13 integration tests; 8 focus on employee permissions.
It checks valid moves, all-stock moves, concurrent moves, protected product
fields, protected location/category setup, forged/unbalanced transfers,
metadata tampering, unlisted destinations, replay attempts and unverified or
outside-domain users. Existing tests also verify pending employee counts and
denial of approval/direct stock changes. Seven other regression tests remain.

Observed concurrency test: four requests for 6 units from a source of 20 allow
three transfers and reject the fourth, leaving 2/18 and total 20.

Browser checks use the local demo account `employee-test@electro-mech.com`
(password `Local-browser-only-482!`, created by the local seed script).
The employee inventory table shows Move/History/Print but no Edit/Duplicate/
Delete/Admin actions. A real UI transfer of 5 from 20 saves 15/5 and a transfer
record attributed to the employee. The phone layout exposes physical counts
and the camera shortcut. Physical camera decoding requires a real phone and
has not been retested here.

The employee phone count screen also submitted a counted quantity of 14
against book 15. The session was pending/unposted under the employee's email,
the 15/5 stock quantities did not change, and approval controls were absent.

## Release requirement

This branch changes both application code and Firestore rules. It is tested
locally and proposed in a PR; hosted rules have not been deployed. Release
the app and the reviewed rules together. Both location definitions must be
saved as actual `locations` documents; a display-only fallback is insufficient
for an employee write. Provision administrator claims through a trusted
administration environment before deploying the rules, as described in
`access-control-setup.md`.

This does not resolve all concurrent legacy-record-creation or SKU-rename
races described in `inventory-workflow-verification.md`.
