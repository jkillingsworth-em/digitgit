# DigitGit access control setup

## Intended roles

- Verified `@electro-mech.com` Firebase Authentication users: inventory read access, balanced transfers between saved locations, barcode labels, Exceptions read-only, and physical counts submitted for review.
- Administrators: additionally manage inventory, stock, categories, locations, imports, database tools, sync, and approve/reject cycle counts.
- Designated initial admin: `jkillingsworth@electro-mech.com`. One more person may be added by a trusted administrator later. Grant by **Firebase UID/custom claim**, not by an editable document or mere email comparison.

## Bootstrap the first admin (requires a trusted project administrator)

1. Confirm the Firebase project is `digitgit-93d87` and the listed email belongs to the intended person.
2. Verify that person already exists in Firebase Authentication and has verified their email.
3. On a trusted workstation with Node.js, install `firebase-admin` temporarily (`npm install --no-save firebase-admin`). Use Google Application Default Credentials with authorized Firebase Authentication admin permissions, for example `gcloud auth application-default login` using an appropriately authorized company account. Avoid creating or downloading service account keys if possible.
4. Run `node scripts/set-admin-claim.mjs jkillingsworth@electro-mech.com`.
5. Sign out/in to refresh ID token. Confirm `admin: true` in the token before deploying any restrictive Firestore rules.
6. **Test in the Firebase emulator**, first as an employee and as an admin, before publishing `firestore.rules`. These GitHub files do **not** deploy rules.
7. Add the second admin later via a deliberate reviewed provisioning procedure; the bootstrap script intentionally does not allow other email addresses.

## Required checks before merge/deployment

- Authenticate both employee and admin with verified corporate email (including Google Sign-In email-verification semantics).
- Employees may submit pending `cycleCounts` and perform balanced transfers through the protected transfer transaction. Other writes are denied.
- Employees cannot set the `admin` claim, approve a count, or make arbitrary stock changes outside a valid transfer.
- An admin can approve or reject a pending session. Approving applies changes only when recorded book quantities still match live stock.
- Invalid session payloads, changing a pending session, or repeated approvals are denied.
- Verify all existing non-admin inventory features against security rules. Some historical workflows may require write access and must be explicitly reviewed.
- Run `npm run build`; test concurrent receipts/transfers and approval flows against the emulator.
- Deploy the reviewed app and Firestore rules together after the release checks pass.
