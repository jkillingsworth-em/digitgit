import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { buildSageImportPlan, parseSageFile, splitBinCode, suggestPrefixChoice } from '../utils/sageImport.ts';

// A tiny workbook shaped like the Sage inventory export (shared strings + numbers, one empty cell).
const strings = ['Item Code', 'Item Code Description', 'Qty On Hand', 'Qty On PO', 'Bin Location', 'UD F BI N 2', 'UD F BI N 3',
  '563-20-1000', 'PCB, 11IN FULL DIGIT, RED', 'OTHER', 'B4-SH-F', 'C3-DEFAULT', '563-20-1055', 'PCB &amp; AMBER', 'S1-SH-D', 'J-LOFT-2', 'NEW-PART'];
const s = i => `<c t="s"><v>${i}</v></c>`;
const n = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
const sheet = `<worksheet><sheetData>
<row r="1">${[0, 1, 2, 3, 4, 5, 6].map(s).join('')}</row>
<row r="2">${s(7)}${s(8)}${n('C2', 1840)}${n('D2', 1000)}${s(9)}${s(10)}${s(11)}</row>
<row r="3">${s(12)}${s(13)}${n('C3', -16)}${n('D3', 0)}${s(14)}<c r="G3" t="s"><v>15</v></c></row>
<row r="4">${s(16)}${s(8)}${n('C4', 5)}${n('D4', 0)}${s(15)}</row>
</sheetData></worksheet>`;
const workbook = zipSync({
  'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/sharedStrings.xml': strToU8(`<sst>${strings.map(t => `<si><t>${t}</t></si>`).join('')}</sst>`),
  'xl/worksheets/sheet1.xml': strToU8(sheet),
});

test('reads a Sage .xlsx export: quantities, negatives, and every bin column', () => {
  const { lines, warnings } = parseSageFile('sage.xlsx', workbook);
  assert.deepEqual(warnings, []);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], { itemId: '563-20-1000', description: 'PCB, 11IN FULL DIGIT, RED', qtyOnHand: 1840, qtyOnPO: 1000, bins: ['OTHER', 'B4-SH-F', 'C3-DEFAULT'] });
  assert.equal(lines[1].qtyOnHand, -16);
  assert.equal(lines[1].description, 'PCB & AMBER');
  assert.deepEqual(lines[1].bins, ['S1-SH-D', 'J-LOFT-2']); // the empty F3 cell is skipped
});

test('reads the same export saved as CSV', () => {
  const csv = 'Item Code,Item Code Description,Qty On Hand,Qty On PO,Bin Location\r\n563-20-1000,"PCB, 11IN",1840,1000,J-ROW-S\r\n';
  const { lines } = parseSageFile('sage.csv', strToU8(csv));
  assert.deepEqual(lines, [{ itemId: '563-20-1000', description: 'PCB, 11IN', qtyOnHand: 1840, qtyOnPO: 1000, bins: ['J-ROW-S'] }]);
});

test('rejects a file without the Sage columns', () => {
  assert.throws(() => parseSageFile('x.csv', strToU8('Part,Count\r\nA,1\r\n')), /Item Code/);
});

test('bin codes split into building and sub-location; DEFAULT/OTHER mean anywhere', () => {
  assert.deepEqual(splitBinCode('j-loft-2'), { code: 'J-LOFT-2', prefix: 'J', subLocation: 'LOFT-2' });
  assert.deepEqual(splitBinCode('R2-SH-H'), { code: 'R2-SH-H', prefix: 'R2', subLocation: 'SH-H' });
  assert.equal(splitBinCode('C3-DEFAULT').subLocation, '');
  assert.deepEqual(splitBinCode('OTHER'), { code: 'OTHER', prefix: 'OTHER', subLocation: '' });
});

test('suggestions: J and C match existing warehouses, B/D/R2 become named new locations, S1 waits for a choice', () => {
  const locations = [{ id: 'wh-j', name: 'WH-J' }, { id: 'wh-c', name: 'WH-C' }, { id: 'prod', name: 'PROD' }];
  assert.deepEqual(suggestPrefixChoice('J', locations), { kind: 'existing', locationId: 'wh-j' });
  assert.deepEqual(suggestPrefixChoice('C3', locations), { kind: 'existing', locationId: 'wh-c' });
  assert.deepEqual(suggestPrefixChoice('B4', locations), { kind: 'new', name: 'STORAGE RACK B' });
  assert.deepEqual(suggestPrefixChoice('D3', locations), { kind: 'new', name: 'SHIPPING WAREHOUSE' });
  assert.deepEqual(suggestPrefixChoice('R2', locations), { kind: 'new', name: 'ROOM 2' });
  assert.equal(suggestPrefixChoice('S1', locations), undefined);
  assert.deepEqual(suggestPrefixChoice('S1', locations, 'prod'), { kind: 'existing', locationId: 'prod' });
  assert.deepEqual(suggestPrefixChoice('OTHER', locations, ''), { kind: 'skip' });
});

test('import plan adds only missing bins, creates new locations, and lists parts the app lacks', () => {
  const { lines } = parseSageFile('sage.xlsx', workbook);
  const locations = [{ id: 'wh-j', name: 'WH-J', subLocations: ['LOFT-1'] }, { id: 'wh-c', name: 'WH-C' }];
  const choices = {
    J: { kind: 'existing', locationId: 'wh-j' },
    C3: { kind: 'existing', locationId: 'wh-c' },
    B4: { kind: 'new', name: 'Storage rack B' },
    OTHER: { kind: 'skip' },
  };
  const plan = buildSageImportPlan(lines, locations, choices, new Set(['563-20-1000', '563-20-1055']));
  assert.deepEqual(plan.unplacedPrefixes, ['S1']);
  assert.deepEqual(plan.newLocations, [{ id: 'storage-rack-b', name: 'STORAGE RACK B' }]);
  assert.deepEqual(plan.addSubLocations, [
    { locationId: 'storage-rack-b', locationName: 'STORAGE RACK B', names: ['SH-F'] },
    { locationId: 'wh-j', locationName: 'WH-J', names: ['LOFT-2'] },
  ]);
  assert.deepEqual(plan.itemUpdates.map(u => [u.itemId, u.sageQty, u.sageOnPO]), [['563-20-1000', 1840, 1000], ['563-20-1055', -16, 0]]);
  assert.deepEqual(plan.notInApp.map(l => l.itemId), ['NEW-PART']);
  assert.deepEqual(plan.prefixMap, { J: 'wh-j', C3: 'wh-c', B4: 'storage-rack-b', OTHER: '' });
});
