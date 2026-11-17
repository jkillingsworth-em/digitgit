import { SAGE_MAIN_LOCATIONS, locationIdForName } from './sageImport.ts';

interface LocationLike { id: string; name: string; subLocationPrompt?: string; subLocations?: string[] }
interface StockLike { itemId: string; locationId: string; quantity: number; source?: string; subLocationDetail?: string; docId?: string }

/** For each current app location that isn't a Sage location: the Sage location name to fold it into, or 'keep'. */
export type SwitchChoices = Record<string, string | 'keep'>;

export interface LocationSwitchPlan {
  /** Sage main locations to create empty. */
  create: { id: string; name: string }[];
  /** Old locations renamed in place to a Sage name (stock stays put, ids don't change). */
  rename: { id: string; from: string; to: string }[];
  /** Old locations whose stock moves into another location; the old location is then removed. */
  merge: { fromId: string; fromName: string; toId: string; toName: string }[];
  /** Stock writes for the merges. */
  stockMoves: {
    /** On-hand record: delete `fromDocId`, write `toDocId` with the summed quantity. PO records keep their id. */
    fromDocId: string;
    toDocId: string;
    itemId: string;
    toLocationId: string;
    quantity: number;
    source: string;
    subLocationDetail: string;
    /** True when the target already had this part, so quantities were added together. */
    combined: boolean;
  }[];
  /** Parts whose two bins disagreed when combining; the bin holding more units was kept. */
  binConflicts: { itemId: string; locationName: string; kept: string; dropped: string }[];
  /** Sub-location lists to add to each surviving location. */
  subLocations: Record<string, string[]>;
  /** New location order: Sage locations first (A, B, C, D, I, J, K, L), then anything kept. */
  order: string[];
  unitsMoved: number;
}

const upper = (value: string) => value.trim().toUpperCase();

/** Suggests a Sage location for an app location from the Google Sheet era, when the match is obvious. */
export function suggestSwitchTarget(location: LocationLike): string | undefined {
  const name = upper(location.name);
  const id = upper(location.id);
  for (const sage of SAGE_MAIN_LOCATIONS) {
    if (sage.letter === 'A' || sage.letter === 'B' || sage.letter === 'C' || sage.letter === 'D') continue;
    // WH-J / J WAREHOUSE → WAREHOUSE J (warehouses only: "C warehouse" isn't obviously Section C)
    if ([name, id].some(v => v === `WH-${sage.letter}` || v === `WH ${sage.letter}` || v === `${sage.letter} WAREHOUSE`)) return sage.name;
  }
  return undefined;
}

export function buildLocationSwitchPlan(locations: LocationLike[], stock: StockLike[], choices: SwitchChoices): LocationSwitchPlan {
  const sageNames = SAGE_MAIN_LOCATIONS.map(loc => loc.name);
  const byName = new Map(locations.map(loc => [upper(loc.name), loc]));
  const unitsAt = (id: string) => stock.filter(s => s.locationId === id).reduce((sum, s) => sum + Math.abs(s.quantity), 0);

  // Where each Sage location will live: an existing one with that name, an old one renamed, or a new one.
  const targetId = new Map<string, string>();
  const rename: LocationSwitchPlan['rename'] = [];
  const merge: LocationSwitchPlan['merge'] = [];
  const create: LocationSwitchPlan['create'] = [];
  sageNames.forEach(name => {
    const existing = byName.get(name);
    if (existing) { targetId.set(name, existing.id); return; }
    const sources = locations
      .filter(loc => choices[loc.id] === name)
      .sort((a, b) => unitsAt(b.id) - unitsAt(a.id));
    if (sources.length > 0) {
      targetId.set(name, sources[0].id);
      rename.push({ id: sources[0].id, from: sources[0].name, to: name });
      return;
    }
    const id = locationIdForName(name);
    targetId.set(name, id);
    create.push({ id, name });
  });

  locations.forEach(loc => {
    const choice = choices[loc.id];
    if (!choice || choice === 'keep' || sageNames.includes(upper(loc.name))) return;
    const toId = targetId.get(choice);
    if (!toId || toId === loc.id) return;
    merge.push({ fromId: loc.id, fromName: loc.name, toId, toName: choice });
  });

  // Stock moves for merges. On-hand records are one per part per location, so combine with any already there.
  const mergedFrom = new Map(merge.map(m => [m.fromId, m]));
  const finalOnHand = new Map<string, { quantity: number; subLocationDetail: string; biggest: number; combined: boolean }>();
  stock.forEach(s => {
    if (s.source === 'PO' || mergedFrom.has(s.locationId)) return;
    finalOnHand.set(`${s.itemId}_${s.locationId}`, { quantity: s.quantity, subLocationDetail: upper(s.subLocationDetail || ''), biggest: Math.abs(s.quantity), combined: false });
  });
  const stockMoves: LocationSwitchPlan['stockMoves'] = [];
  const binConflicts: LocationSwitchPlan['binConflicts'] = [];
  let unitsMoved = 0;
  stock.forEach(s => {
    const m = mergedFrom.get(s.locationId);
    if (!m) return;
    unitsMoved += s.quantity;
    const sub = upper(s.subLocationDetail || '');
    if (s.source === 'PO') {
      stockMoves.push({ fromDocId: s.docId || '', toDocId: s.docId || '', itemId: s.itemId, toLocationId: m.toId, quantity: s.quantity, source: 'PO', subLocationDetail: sub, combined: false });
      return;
    }
    const key = `${s.itemId}_${m.toId}`;
    const there = finalOnHand.get(key);
    if (!there) {
      finalOnHand.set(key, { quantity: s.quantity, subLocationDetail: sub, biggest: Math.abs(s.quantity), combined: false });
    } else {
      if (sub && there.subLocationDetail && sub !== there.subLocationDetail) {
        const keepMoved = Math.abs(s.quantity) > there.biggest;
        binConflicts.push({ itemId: s.itemId, locationName: m.toName, kept: keepMoved ? sub : there.subLocationDetail, dropped: keepMoved ? there.subLocationDetail : sub });
        if (keepMoved) there.subLocationDetail = sub;
      } else if (!there.subLocationDetail) there.subLocationDetail = sub;
      there.quantity += s.quantity;
      there.biggest = Math.max(there.biggest, Math.abs(s.quantity));
      there.combined = true;
    }
    stockMoves.push({ fromDocId: s.docId || `${s.itemId}_${s.locationId}`, toDocId: key, itemId: s.itemId, toLocationId: m.toId, quantity: 0, source: 'OH', subLocationDetail: '', combined: false });
  });
  // Fill in final quantities/bins for on-hand moves (several old locations can land on one record).
  stockMoves.forEach(move => {
    if (move.source === 'PO') return;
    const final = finalOnHand.get(move.toDocId)!;
    move.quantity = final.quantity;
    move.subLocationDetail = final.subLocationDetail;
    move.combined = final.combined;
  });

  const subLocations: Record<string, string[]> = {};
  merge.forEach(m => {
    const from = locations.find(loc => loc.id === m.fromId);
    const names = (from?.subLocations || []).map(upper).filter(Boolean);
    if (names.length) subLocations[m.toId] = Array.from(new Set([...(subLocations[m.toId] || []), ...names]));
  });

  const survivors = locations.filter(loc => !mergedFrom.has(loc.id)).map(loc => loc.id);
  const sageIds = sageNames.map(name => targetId.get(name)!);
  const order = [...sageIds, ...survivors.filter(id => !sageIds.includes(id))];

  return { create, rename, merge, stockMoves, binConflicts, subLocations, order, unitsMoved };
}
