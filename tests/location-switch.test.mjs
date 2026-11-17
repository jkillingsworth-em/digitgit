import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationSwitchPlan, suggestSwitchTarget } from '../utils/locationSwitch.ts';

const locations = [
  { id: 'wh-c', name: 'WH-C', subLocations: [] },
  { id: 'wh-j', name: 'WH-J', subLocations: ['SHELF 1'] },
  { id: 'prod', name: 'PROD', subLocations: ['OFFICE'] },
];
const stock = [
  { itemId: 'A', locationId: 'wh-j', quantity: 10, source: 'OH', subLocationDetail: 'SHELF 1', docId: 'A_wh-j' },
  { itemId: 'A', locationId: 'prod', quantity: 25, source: 'OH', subLocationDetail: 'OFFICE', docId: 'A_prod' },
  { itemId: 'B', locationId: 'prod', quantity: 3, source: 'OH', subLocationDetail: '', docId: 'B_prod' },
  { itemId: 'B', locationId: 'prod', quantity: 50, source: 'PO', docId: 'PO-77' },
  { itemId: 'C', locationId: 'wh-c', quantity: 7, source: 'OH', docId: 'C_wh-c' },
];

test('suggests only obvious warehouse matches', () => {
  assert.equal(suggestSwitchTarget({ id: 'wh-j', name: 'WH-J' }), 'WAREHOUSE J');
  assert.equal(suggestSwitchTarget({ id: 'wh-k', name: 'WH-K' }), 'WAREHOUSE K');
  assert.equal(suggestSwitchTarget({ id: 'wh-c', name: 'WH-C' }), undefined); // C warehouse vs Section C is the owner's call
  assert.equal(suggestSwitchTarget({ id: 'prod', name: 'PROD' }), undefined);
});

test('renames the first location for each Sage name, merges the rest, and creates the missing ones', () => {
  const plan = buildLocationSwitchPlan(locations, stock, { 'wh-c': 'SECTION C', 'wh-j': 'WAREHOUSE J', prod: 'WAREHOUSE J' });
  assert.deepEqual(plan.rename.map(r => [r.id, r.to]).sort(), [['prod', 'WAREHOUSE J'], ['wh-c', 'SECTION C']]); // PROD holds more units, so it keeps its id
  assert.deepEqual(plan.merge, [{ fromId: 'wh-j', fromName: 'WH-J', toId: 'prod', toName: 'WAREHOUSE J' }]);
  assert.deepEqual(plan.create.map(c => c.name), ['SECTION A', 'SECTION B', 'SECTION D', 'WAREHOUSE I', 'WAREHOUSE K', 'WAREHOUSE L']);
  // A: 10 from WH-J added to the 25 already there; PROD's bin (more units) wins.
  assert.deepEqual(plan.stockMoves, [{ fromDocId: 'A_wh-j', toDocId: 'A_prod', itemId: 'A', toLocationId: 'prod', quantity: 35, source: 'OH', subLocationDetail: 'OFFICE', combined: true }]);
  assert.deepEqual(plan.binConflicts, [{ itemId: 'A', locationName: 'WAREHOUSE J', kept: 'OFFICE', dropped: 'SHELF 1' }]);
  assert.deepEqual(plan.subLocations, { prod: ['SHELF 1'] });
  assert.equal(plan.unitsMoved, 10);
  assert.deepEqual(plan.order.slice(0, 8), ['section-a', 'section-b', 'wh-c', 'section-d', 'warehouse-i', 'prod', 'warehouse-k', 'warehouse-l']);
});

test('merging into an empty target moves on-hand and purchase-order stock without combining', () => {
  const plan = buildLocationSwitchPlan(locations, stock, { 'wh-c': 'WAREHOUSE J', 'wh-j': 'WAREHOUSE J', prod: 'keep' });
  assert.deepEqual(plan.merge.map(m => m.fromId), ['wh-c']);
  assert.deepEqual(plan.stockMoves, [{ fromDocId: 'C_wh-c', toDocId: 'C_wh-j', itemId: 'C', toLocationId: 'wh-j', quantity: 7, source: 'OH', subLocationDetail: '', combined: false }]);
  assert.ok(plan.order.includes('prod'));
  // PROD folds into an existing WAREHOUSE J: its on-hand record moves and its purchase-order record follows.
  const intoExisting = buildLocationSwitchPlan([...locations, { id: 'j', name: 'WAREHOUSE J' }], stock, { 'wh-c': 'keep', 'wh-j': 'keep', prod: 'WAREHOUSE J' });
  assert.deepEqual(intoExisting.stockMoves.map(m => [m.fromDocId, m.toDocId, m.toLocationId, m.quantity, m.source]), [
    ['A_prod', 'A_j', 'j', 25, 'OH'],
    ['B_prod', 'B_j', 'j', 3, 'OH'],
    ['PO-77', 'PO-77', 'j', 50, 'PO'],
  ]);
  assert.equal(intoExisting.unitsMoved, 78);
});

test('a location already named after Sage is left alone', () => {
  const plan = buildLocationSwitchPlan([{ id: 'j', name: 'Warehouse J' }, ...locations.slice(0, 1)], stock, { 'wh-c': 'WAREHOUSE J' });
  assert.deepEqual(plan.rename, []);
  assert.deepEqual(plan.merge, [{ fromId: 'wh-c', fromName: 'WH-C', toId: 'j', toName: 'WAREHOUSE J' }]);
});
