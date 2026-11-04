import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renamedStock } from '../utils/renamedStock.ts';

test('SKU rename updates stored document identity and preserves receipt metadata', () => {
  const original = { itemId: 'IMPORT-LED', locationId: 'test-a', quantity: 8, source: 'PO', poNumber: 'PO-1', docId: 'IMPORT-LED_test-a', locationBarcode: 'BIN-A', subLocationDetail: 'Shelf 3', dateReceived: '2026-11-04', customNote: 'keep this' };
  const migrated = renamedStock(original, 'RENAMED-LED', 'test-a', 'RENAMED-LED_test-a');
  assert.equal(migrated.docId, 'RENAMED-LED_test-a');
  assert.equal(migrated.itemId, 'RENAMED-LED');
  assert.equal(migrated.quantity, 8);
  for (const key of ['source', 'poNumber', 'locationBarcode', 'subLocationDetail', 'dateReceived', 'customNote']) {
    assert.equal(migrated[key], original[key]);
  }
  assert.equal(original.docId, 'IMPORT-LED_test-a');
});
