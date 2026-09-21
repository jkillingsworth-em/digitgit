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

## Exceptions dashboard

**Admin → Exceptions** (also on the desktop dashboard Admin Options and Admin Hub).

digitgit remains the **floor system of record**. The Exceptions view compares in-memory floor stock to the SAGE snapshot fields on each item (`sageQty`, `sageAsOf`) and flags data-health issues — no new Firestore collections.

| Type | Meaning |
| --- | --- |
| `sage_variance` | Floor qty ≠ SAGE qty (sorted by absolute delta) |
| `missing_sage` | Floor qty &gt; 0 but no SAGE qty |
| `sage_without_floor` | SAGE qty &gt; 0 but floor qty is 0 |
| `negative_stock` | Any stock row with quantity &lt; 0 |
| `orphan_stock` | Stock row whose item id is not in items |
| `incomplete_item` | Missing description or category |

Floor qty = sum of `stock.quantity` for that item across all locations (`wh-c`, `wh-k`, `wh-j`, `prod`, `inspect`, etc.).


## Cycle Count mode

**Admin → Cycle Count** (also on the desktop dashboard Admin Options and Admin Hub).

Floor-friendly workflow for counting one location at a time. digitgit remains the **floor system of record**; after posting, push warehouse quantities to the EM sheet separately via **Sync EM Sheet**.

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

## Live Google Sheets sync (EM Digit Inventory)

digitgit is the **floor system of record** for warehouse counts.

The **app** is the source of truth for product **category** (and other identity/master fields such as description and color). Sheets Pull does not overwrite those. The Google Sheet remains a digit **qty** mirror (plus SAGE / 3-year avg reference values on Pull).

| Direction | What syncs |
| --- | --- |
| **Pull** (Sheet → Firebase) | **Only** `sageQty` (+ `sageAsOf` when present) and `threeYearAvg` on existing items. Brand-new sheet SKUs get a minimal create (id/name/description; category left empty for the app to assign). **Does not** overwrite category, description, color, or stock. The live sheet has no category column today — the **app owns category**. |
| **Push** (Firebase → Sheet) | Floor stock quantities into sheet warehouse columns only (matched by item code). Does **not** write categories. |

### Warehouse mapping

| digitgit location id | Sheet column |
| --- | --- |
| `wh-c` | C WAREHOUSE |
| `wh-k` | K WAREHOUSE |
| `wh-j` | J WAREHOUSE |
| `prod` | PRODUCTION SHELF |

### Google Cloud setup

1. In [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Sheets API** for your project.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Add **Authorized JavaScript origins**:
   - `http://localhost:3000` (local Vite)
   - `https://digitgit.vercel.app` (production)
4. Copy the client ID into `.env.local` (see [.env.example](.env.example)):

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# optional override
VITE_EM_DIGIT_SHEET_ID=1sBtdqpGCWXTUd9KTKT5nF5mbG_r8KSIICvFlzizTbmw
```

5. Restart `npm run dev` after changing env vars.
6. In the app: **Admin → Sync EM Sheet** (or the dashboard **Sync EM Sheet** tile) → **Connect Google** → Pull / Push / Sync both.

The browser uses Google Identity Services (token client) plus the Sheets API v4 REST endpoints. No service-account secret is stored in the app; the signed-in Google user must have access to the spreadsheet.
