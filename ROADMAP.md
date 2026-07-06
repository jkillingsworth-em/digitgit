# Roadmap - Electro-Mech Inventory Tracker

Live app: https://digitgit.vercel.app/
Working branch: `fix/build-cleanup` -> merged to `main` at stable milestones.

Workflow per session: review architecture -> focused change -> typecheck -> build -> commit -> push.
Every change small, testable, reversible.

## Phase 0 - Repo Hygiene (done 2026-07-02)

- [x] Prune stale branches (keep `main`, `fix/build-cleanup`)
- [x] Fix duplicated vite / plugin-react dependencies
- [x] Untrack chatlog.txt, ignore .claude/
- [x] Add CHANGELOG.md + ROADMAP.md

## Phase 1 - Architecture Stabilization (done 2026-07-02)

- [x] Remove duplicate/nested `DbProvider`
- [x] Centralize all Firestore access (services/ layer; zero direct calls in components)
- [x] Remove duplicated state (all state lives in useAppController + domain hooks)
- [x] Separate business logic from UI (useAppController is render-free)
- [x] App.tsx from 827 lines to ~180
- [ ] Manual smoke checklist pending: add item, move stock, scan barcode, export,
      location CRUD, generate report, smart export, admin hub navigation

## Phase 2 - Data Layer (done 2026-07-02)

- [x] inventoryService (add/edit/delete/batch-delete/bulk-edit/import/purgeAll)
- [x] categoryService (hierarchy load/save)
- [x] locationService (fetch/CRUD/seed defaults)
- [x] reportService (report rows, low-alert helpers)
- [x] stockService (move, bulk transfer, bulk quantity update)
- [x] exportService (quick + tailored CSV)
- [x] App.tsx reduced to composition (DashboardView + AppModals)

## Phase 3 - Finish Missing Features (mostly done)

- [x] Complete Location Manager CRUD (was wired to no-ops)
- [x] Category Manager (4-level CRUD w/ rename + drag-drop was already complete)
- [x] Hierarchy storage centralized in categoryService (single doc at settings/categoryHierarchy)
- [x] Complete Tailored Export (was a no-op)
- [x] Complete Reporting (generate + preview + real low-alert count)
- [x] Recreate ADMIN hub (nav dropdown + Admin Control Center; source was lost from repo) (2026-07-06)
- [~] Purge tools: selective batch purge works; full database wipe exists as
      `inventoryService.purgeAllData` but is deliberately NOT wired to UI -
      needs a product decision (see Open Questions)

### Open questions for Joshua

- Should a "wipe entire database" button exist in Purge Manager? The service is ready.
- Legacy `subCategory` field: items still carry it alongside the newer
  subCategory1/2/3 hierarchy. A one-time data migration would clean this,
  but should be run deliberately with a backup.

## Phase 3.5 - Production parity backlog (live-app audit 2026-07-06)

Features observed on the production deployment whose source was lost; not yet
rebuilt on this branch, ordered by value:

- [ ] Location Manager (rich version): search box, sort by manager order,
      up/down reordering, expandable cards with stats chips (units, unique
      SKUs, per-category breakdown), per-location MANAGE INVENTORY shortcut,
      PRINT LABELS per location, sub-location chips (add/remove), editable
      location ID in the edit form
- [ ] Inventory Management console: ADD INVENTORY tab (add-item form inside
      the console; currently a separate Add Item modal), effective-date field,
      undo/redo, ASSIGN CATEGORY / ASSIGN LOCATION bulk buttons
- [ ] Database Management (integrity version): "database integrity verified"
      health check, PURGE LEGACY COLORS, PURGE DATABASE (purgeAllData service
      is already written - needs UI + double confirmation)
- [ ] Inventory table: STATUS column with IN STOCK / low badges; ADD ALL
      button (select all visible)
- [ ] Report Preview: EXPORT PDF button (branch has CSV; verify PDF export works)

Redundancies removed on this branch (2026-07-06):

- Header ADD ITEM button + ACTIONS dropdown (actions moved under ADMIN)
- Standalone BulkTransferModal + MassStockUpdateModal (tabs in the console)
- Production's per-row "History" placeholder report (branch generates real
  per-location report rows instead)

## Phase 4 - Inventory Intelligence

- [ ] Cycle counting
- [ ] Inventory / stock movement history
- [ ] Audit trail ("who changed this?")
- [ ] Undo inventory moves
- [ ] Low inventory dashboard
- [ ] Warehouse utilization
- [ ] Barcode history
- [ ] Inventory valuation (optional)

## Phase 5 - Production Quality

- [ ] Performance optimization & code splitting
- [ ] Offline support
- [ ] Firebase Security Rules audit
- [ ] Automatic backups
- [ ] Error logging
- [ ] Role-based permissions
- [ ] Dark mode (optional)
