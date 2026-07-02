# Changelog

All notable changes to the Electro-Mech Inventory Tracker are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Newest entries first.

## [Unreleased]

### Sprint 0 — Repo & Dependency Hygiene (2026-07-02)

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
