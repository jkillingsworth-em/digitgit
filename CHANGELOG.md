# Changelog

All notable changes to the Electro-Mech Inventory Tracker are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Newest entries first.

## [Unreleased]

### ADMIN hub recreation (2026-07-06)

- Discovered the production deployment (digitgit.vercel.app) runs code that no
  longer exists anywhere in the repo - the ADMIN nav dropdown and "Admin Control
  Center" page were lost before the recovery-era commits
- Recreated both against the new architecture: `components/AdminHub.tsx`,
  ADMIN nav item + dropdown in NavigationView (desktop + mobile), `admin-hub` view
- Hub cards map to existing features: Inventory Management -> BulkEdit workspace,
  Category/Location Management -> admin views, Database Management -> Purge Manager,
  Import/Export -> import modal + smart export

### Sprint 1 - Architecture Stabilization + Feature Completion (2026-07-02)

**Architecture (no visual changes intended):**

- Removed nested `DbProvider` (was mounted in both index.tsx and App.tsx)
- New data layer: `services/` (inventory, stock, location, category, export, report)
  and `utils/sanitize.ts` - every Firestore read/write now goes through a service
- New `hooks/useAppController.ts` holds all app state and business logic;
  `App.tsx` reduced from 827 to ~180 lines of pure composition
- New `hooks/useToast.ts`, `hooks/useLocations.ts`, `components/AppModals.tsx`,
  `components/DashboardView.tsx`
- Removed dead code: unused `definedCategories` fetch, unused `categoryHierarchy`
  memo, unwired purge-database handler (preserved as `inventoryService.purgeAllData`),
  dead `itemToDelete` state, empty `useHistoryState` hook
- Fixed typing so `npx tsc --noEmit` passes clean (now usable as a CI gate)

**Completed features (previously dead UI):**

- Location Manager: add/edit/delete now persist to Firestore (handlers were no-ops);
  delete asks for confirmation
- Generate Report: builds real report data and opens the preview (button did nothing);
  low-alert count in the modal is now computed instead of hardcoded 0
- Tailored "Smart" Export: generates the CSV with selected optional fields (was a no-op)
- Duplicate item: now pre-fills the Add Item modal with the source item
- Print barcode from table: opens the location picker (SelectPrintLocationModal was unreachable)
- Mass Stock Update modal now closes after a successful update
- Per-item report from the table now shows real per-location stock rows
  (previously produced a single empty placeholder row)

### Sprint 0 - Repo & Dependency Hygiene (2026-07-02)

- Removed duplicate `vite` and `@vitejs/plugin-react` entries from `dependencies`
  (they now live only in `devDependencies`, pinned to the versions actually installed:
  vite ^6.4.3, @vitejs/plugin-react ^5.1.1)
- Untracked `chatlog.txt` and added it to `.gitignore` (kept locally)
- Added `.claude/` to `.gitignore`
- Deleted stale branches: `copilot/add-db-context-provider`, `copilot/featdb-context`,
  `copilot/replace-firestore-imports-with-context`, `devdigitget`, `restore-3tier-categories`.
  Active branches are `main` and `fix/build-cleanup` only.
- Repaired `.git/config` (found truncated by a crashed git process)
- Added `CHANGELOG.md` and `ROADMAP.md`

## Prior history (before changelog)

- `ff2ceed` Fix dependency audit issues
- `b08ef27` Save current inventory app changes before build cleanup
- `3820dc4` Recovery of MobileFooter/MobileDashboard from chat log (PR #7)
