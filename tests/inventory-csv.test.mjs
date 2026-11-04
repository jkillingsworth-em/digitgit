import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryCsv } from '../utils/inventoryCsv.ts';

const item = { id: 'LED', name: 'LED', description: 'Red, "bright" LED', category: 'PARTS', price: 2, priorUsage: [{ year: 2025, usage: 12 }] };
const stock = [{ itemId: 'LED', locationId: 'a', quantity: 5, source: 'OH' }, { itemId: 'LED', locationId: 'b', quantity: 3, source: 'PO' }];
test('export includes every shelf quantity and escapes descriptions', () => {
  const csv = createInventoryCsv([item], stock);
  assert.equal(csv.split('\r\n').length, 3);
  assert.ok(csv.includes('"Red, ""bright"" LED"'));
  assert.ok(csv.includes('"a","OH","5","PARTS"'));
  assert.ok(csv.includes('"b","PO","3","PARTS"'));
});
test('smart export honors chosen optional fields', () => {
  const csv = createInventoryCsv([item], stock, ['price', 'usage_2025']);
  assert.equal(csv.split('\r\n')[0], 'ID,DESCRIPTION,LOCATION,SOURCE,QTY,PRICE,USAGE_2025');
  assert.ok(csv.includes('"5","2","12"'));
});
test('items with no stock still appear with zero quantity', () => {
  assert.ok(createInventoryCsv([item], []).includes('"","OH","0","PARTS"'));
});
