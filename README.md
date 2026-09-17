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

## EM Digit Inventory import

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
| SAGE | `sageQty` |
| SAGE As Of | `sageAsOf` |

Existing **Standard** CSV import (ID / DESCRIPTION / CATEGORY / LOCATION / SOURCE) is unchanged.
