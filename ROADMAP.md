# Roadmap — Electro-Mech Inventory Tracker

Live app: https://digitgit.vercel.app/
Working branch: `fix/build-cleanup` → merged to `main` at stable milestones.

Workflow per session: review architecture → focused change → test locally → build → commit → push.
Every change small, testable, reversible.

## Phase 0 — Repo Hygiene ✅ (2026-07-02)

- [x] Prune stale branches (keep `main`, `fix/build-cleanup`)
- [x] Fix duplicated vite / plugin-react dependencies
- [x] Untrack chatlog.txt, ignore .claude/
- [x] Add CHANGELOG.md + ROADMAP.md

## Phase 1 — Architecture Stabilization (current)

Goal: easier to maintain, zero functional or visual change.

- [ ] Remove duplicate/nested `DbProvider` (index.tsx wraps App, App wraps again)
- [ ] Centralize all Firestore access (App.tsx still has ~15 direct write calls)
- [ ] Remove duplicated state (30 useState in App.tsx vs. useInventoryData hook)
- [ ] Separate business logic from UI
- [ ] App.tsx from ~830 lines to under ~250
- [ ] Manual smoke checklist after each session: add item, move stock, scan barcode, export

## Phase 2 — Data Layer

Extract services so logic is testable outside React:

- [ ] InventoryService
- [ ] CategoryService
- [ ] LocationService
- [ ] ReportService
- [ ] StockMovementService
- [ ] App.tsx reduced to `<Dashboard /> + <Modals />` composition

## Phase 3 — Finish Missing Features

- [ ] Complete Location Manager CRUD
- [ ] Finish Category Manager
- [ ] Clean hierarchy storage
- [ ] Complete Tailored Export
- [ ] Complete Reporting
- [ ] Finish Purge tools

## Phase 4 — Inventory Intelligence

- [ ] Cycle counting
- [ ] Inventory / stock movement history
- [ ] Audit trail ("who changed this?")
- [ ] Undo inventory moves
- [ ] Low inventory dashboard
- [ ] Warehouse utilization
- [ ] Barcode history
- [ ] Inventory valuation (optional)

## Phase 5 — Production Quality

- [ ] Performance optimization & code splitting
- [ ] Offline support
- [ ] Firebase Security Rules audit
- [ ] Automatic backups
- [ ] Error logging
- [ ] Role-based permissions
- [ ] Dark mode (optional)
