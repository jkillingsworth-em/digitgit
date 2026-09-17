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
| Category (optional) | `category` (defaults to `DIGITS`; created on import if missing) |
| C / K / J warehouse qtys | Stock at `wh-c` / `wh-k` / `wh-j` |
| Production Shelf qty | Stock at `prod` |
| 3 Year Avg | `threeYearAvg` |
| SAGE / `SAGE MM/DD/YYYY` | `sageQty` (date in header → `sageAsOf`) |
| SAGE As Of | `sageAsOf` |

Existing **Standard** CSV import (ID / DESCRIPTION / CATEGORY / LOCATION / SOURCE) is unchanged.

## Live Google Sheets sync (EM Digit Inventory)

digitgit is the **floor system of record** for warehouse counts.

| Direction | What syncs |
| --- | --- |
| **Pull** (Sheet → Firebase) | Master fields only: name/description, color, `threeYearAvg`, `sageQty`, `sageAsOf`, category (default `DIGITS`). Creates missing categories. **Does not write or overwrite stock.** |
| **Push** (Firebase → Sheet) | Floor stock quantities into sheet warehouse columns, matched by item code. |

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
