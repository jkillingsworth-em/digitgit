import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInventoryReportPdf } from '../utils/inventoryReportPdf.ts';

const row = { id: 'PDF-LED', name: 'LED', description: 'LED module', category: 'PARTS',
  locationName: 'Shelf A', subLocationDetail: 'Bin 2', quantity: 15, source: 'OH' };

test('inventory report generates a valid PDF containing the actual inventory fields', () => {
  const pdf = createInventoryReportPdf([row]);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.ok(bytes.toString('ascii', 0, 8).startsWith('%PDF-'));
  for (const text of ['Inventory Report', 'PDF-LED', 'LED module', 'Shelf A - Bin 2']) {
    assert.ok(bytes.toString('latin1').includes(text), `Missing ${text}`);
  }
  assert.equal(pdf.getNumberOfPages(), 1);
});

test('large inventory reports paginate without dropping the final SKU', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ ...row, id: `PDF-${i}` }));
  const pdf = createInventoryReportPdf(rows);
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(pdf.output().includes('PDF-149'));
  assert.equal(rows[0].quantity, 15);
});
