# Architecture — Electro-Mech Inventory Tracker

One page. Update when structure changes.

## Data flow

```
Firestore
   │  (all access goes through services/)
   ▼
services/          pure async functions, take `db` as first arg, no React
   ▼
hooks/             React state wrappers
   ├─ useInventoryData   live listeners: inventory, stock, categoryColors
   ├─ useLocations       locations list + CRUD (refresh after mutation)
   ├─ useToast           toast state
   └─ useAppController   ALL app state + handlers; the only "brain"
   ▼
App.tsx            174 lines, render-only composition
   ├─ Header / NavigationView / MobileFooter
   ├─ DashboardView (mobile + desktop dashboards)
   ├─ CategoryManager / LocationManager / PurgeManager (admin views)
   ├─ InventoryTable (list views)
   └─ AppModals (every modal, driven by controller state)
```

Rule: components never import `firebase/firestore`. They receive data/handlers
via props, or call a service through `useDb()`.

## Firestore collections

| Collection / doc                 | Contents                                        |
|----------------------------------|-------------------------------------------------|
| `inventory/{SKU}`                | InventoryItem (id = SKU, uppercase)             |
| `stock/{SKU_locationid}`         | Stock row; doc id is `ITEMID_locationid`        |
| `locations/{slug}`               | { name, subLocationPrompt? }                    |
| `categoryColors/{name}`          | { color } — keyed by category or subcategory    |
| `settings/categoryHierarchy`     | single nested doc: { MAIN: { SUB1: { SUB2: [SUB3] } } } |

## Category model (types.ts)

- `category` — main, single
- `subCategory1[]`, `subCategory2[]` — multi-select levels
- `subCategory3` — single
- `subCategory` — legacy field, still read for colors/filters; migration pending

## Conventions

- Item ids: uppercase + trimmed. Location ids: lowercase slugs.
- Firestore batches capped at 400 ops (`BATCH_LIMIT`); imports at 450.
- `npx tsc --noEmit` must pass before every commit; `npm run build` must succeed.
- Workflow: small change → typecheck → build → commit → push. One concern per commit.
