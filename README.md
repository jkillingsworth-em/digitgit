<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uv0uFEW3sCLtI3Ddi5pAa1nISeabVvlz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase Authentication

digitgit is gated behind **Firebase Authentication**. Unauthenticated users see the login screen only.

### Firebase Console setup (required)

1. Open [Firebase Console](https://console.firebase.google.com/) → project **digitgit-93d87** (or your project).
2. **Authentication → Sign-in method** — enable:
   - **Google** (preferred for Electro-Mech Google Workspace)
   - **Email/Password** (secondary; for accounts you create in the console)
3. **Authentication → Settings → Authorized domains** — ensure:
   - `localhost`
   - `digitgit.vercel.app`
   - (and any other deploy host you use)
4. Optionally create email/password users under **Authentication → Users**.

### Domain allowlist (optional)

In `.env.local` (see [.env.example](.env.example)):

```bash
VITE_ALLOWED_EMAIL_DOMAINS=electro-mech.com
```

- Comma-separated list of allowed email domains.
- If set, sign-in succeeds only when the user’s email domain is listed; otherwise the app signs them out immediately and shows a message.
- If **unset**, any authenticated Firebase user is allowed.

Restart `npm run dev` after changing env vars.

### Firestore security rules

Client Auth alone does **not** lock down data. Paste the sample rules from [`firestore.rules`](firestore.rules) into **Firebase Console → Firestore → Rules**, then **Publish**.

These rules are **not** auto-deployed by this repo. Until you publish them, the database may still be readable/writable without Auth.

## Sage check

**Operations → Sage check.** digitgit remains the **floor system of record**; Sage numbers are only compared, never copied over app quantities.

An admin uploads the Sage inventory export (.xlsx or .csv with *Item Code*, *Qty On Hand*, *Qty On PO*, *Bin Location* and the *UDF BIN* columns). Before anything is saved, the page shows:

- **Where Sage bins go.** Main locations follow the facility floor plan: Sections A–D (A Athens/offices, B Boston, C Chicago, D Detroit) and Warehouses I, J, K, L (Islamabad, Jerusalem, Kyoto, Liverpool). A bare building letter drops off (`J-ROW-R` → Warehouse J, bin `ROW-R`); areas and rooms keep their code as the bin (`B7-SH-A` → Section B, bin `B7-SH-A`; rooms `R#` and Storage Room `S1` are in Section A). `DEFAULT` = anywhere in that building/area; `OTHER` = anywhere in the facility (left out). Choices are saved in `settings/sageImport.prefixMap`.
- **Set bins from Sage (optional).** Sets a part's bin to Sage's "Bin Location" where the app already has that part in the same building.
- **Bins to add.** Bins the app doesn't have yet are added as sub-locations.
- **Not in the app.** Parts in the file with no product; listed, not created.

**Switching to Sage locations (one time).** Until all eight Sage locations exist, the page offers a switch: each Google Sheet-era location is mapped to a Sage location. The first one mapped to a Sage name is renamed in place (stock stays put); others have their stock folded in (quantities added, one bin kept per part) and are removed. Pending cycle counts at a merged location block the switch.

Saving writes `sageQty`, `sageOnPO`, `sageBins` and `sageAsOf` on each matching product. The page then lists: count differs, negative in Sage, not in Sage yet, negative in app, stock with no product, and missing details. App on hand excludes stock still on order (PO).

## Cycle Count mode

**Admin → Cycle Count** (also on the desktop dashboard Admin Options and Admin Hub).

Floor-friendly workflow for counting one location at a time. digitgit remains the **floor system of record**.

### How to run a count

1. **Setup** — Choose a location (required). Optionally filter by category and/or search. Toggle **Blind count** (default ON). Add an optional note.
2. **Count** — Enter counted qty for each SKU (large mobile-friendly inputs). Paste/scan a SKU in the jump field to focus that row. Unentered rows are skipped (not treated as zero).
3. **Review** — See Item / Book / Counted / Variance for every entered line. Confirm.
4. **Post** — Writes/deletes stock docs the same way as Inventory Management **AUDIT**, and saves a session document to Firestore collection `cycleCounts`.

### Blind vs open

| Mode | During count | On review/post |
| --- | --- | --- |
| **Blind** (default) | Book qty hidden | Book qty used for variance |
| **Open** | Book qty shown (supervisor) | Same |

### What Post does

- Counted `0` with book &gt; 0 → delete stock at that location (same as AUDIT).
- Counted &gt; 0 with no stock doc → create OH stock at that location.
- Session fields: `id`, `locationId`, `startedAt`, `completedAt`, `countedBy` (auth email/uid), `blindMode`, `note`, `lines[{ itemId, bookQty, countedQty, variance, subLocationDetail? }]`, `posted: true`.
- Toast reports variance count. Setup screen lists the last 5 sessions (read-only).

AUDIT mode in Inventory Management is unchanged.

## EM Digit Inventory import (CSV)

1. In Google Sheets, open **EM Digit Inventory** and download as CSV (**File → Download → Comma-separated values**).
2. In digitgit, open **Import / Export** → **Import from CSV**.
3. Choose mode **EM Digit Inventory** (auto-selected when warehouse columns are detected).
4. Pick the CSV and import.

### Column mapping

| Sheet column | digitgit |
| --- | --- |
| Item Code / Product ID / ID | `InventoryItem.id` |
| Description | `name` + `description` |
| Color | `color` (also appended to description) |
| Category (optional) | `category` (defaults to `UNASSIGNED`; created on import if missing) |
| C / K / J warehouse qtys | Stock at `wh-c` / `wh-k` / `wh-j` |
| Production Shelf qty | Stock at `prod` |
| 3 Year Avg | `threeYearAvg` |
| SAGE / `SAGE MM/DD/YYYY` | `sageQty` (date in header → `sageAsOf`) |
| SAGE As Of | `sageAsOf` |

Existing **Standard** CSV import (ID / DESCRIPTION / CATEGORY / LOCATION / SOURCE) is unchanged.

