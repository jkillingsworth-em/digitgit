# Application verification

## Code checks

The app now installs React 19's TypeScript declarations explicitly. Missing
React declarations accounted for many cascading errors. Receipt grouping and
the optional barcode location metadata now have explicit types. An unused
table callback was removed, redundant mode checks were removed from controls
already hidden in ADD mode, and the location editor handles an unavailable
product without reading a bulk-only property.

`npm run typecheck` is part of the GitHub checks and passes without errors.
This resolves the 49 baseline errors recorded in `dependency-security.md`.

## Local browser verification

The story checked is: an administrator signs in, loads inventory, transfers
stock, receives additional stock, edits a product, and sees persisted results.

The opt-in `VITE_FIREBASE_EMULATORS=true` flag connects a development build on
localhost to `demo-digitgit`, using Auth on port 9095 and Firestore on port
8085. It is ignored in production builds and rejected on non-local browser
hosts. Normal authentication and the repository's Firestore rules still apply.

Start the emulators in one terminal (Node 24 and Java 21):

```sh
npm exec --yes --package firebase-tools@15.34.2 -- firebase emulators:start --config firebase.test.json --project demo-digitgit --only auth,firestore
```

In PowerShell, seed a fresh emulator and start the local app:

```powershell
$env:GCLOUD_PROJECT='demo-digitgit'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8085'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9095'
node tests/seed-local-browser.mjs
$env:VITE_FIREBASE_EMULATORS='true'
npm run dev -- --host 127.0.0.1 --port 3000
```

Use `http://127.0.0.1:3000`, account `browser-test@electro-mech.com` and
password `Local-browser-only-482!`. These credentials are disposable local
fixtures, not hosted Firebase credentials. The seed requires explicit demo
project and emulator environment values and only addresses loopback servers.

## Observed results on November 4, 2026

| Boundary | Result |
| --- | --- |
| Email sign-in → admin dashboard | Passed with demo account and verified email/admin claim |
| Database → inventory table | TEST-LED loaded with 20 units |
| Move Stock → transaction → live dashboard | Move 5 from Test Shelf A to B: stored and displayed quantities 15/5; total remained 20 |
| Add Existing Inventory → receipt → database | Receive 7 at A: stored quantities 22/5; total 27 |
| Refresh → restored authentication/data | Inventory reloaded with total 27 |
| Edit Item Details → save → table | Description became VERIFIED LED MODULE; total remained 27 |
| Browser console | No captured error messages during checked flows |

The three Firebase SDK emulator tests also pass, as do typecheck, audit and
the build. The large-bundle build warning remains. A successful code check is
not proof that all inventory paths are safe under concurrent users.

Not covered here: hosted Google popup authentication, barcode hardware,
printing hardware, imports, SKU renames, cycle-count approval and live Sheets
sync. PR #25's separate inventory-integrity changes are not included in this
branch. These still need focused verification before declaring the entire
application ready.
