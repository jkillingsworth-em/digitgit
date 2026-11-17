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

test('bin codes follow the floor plan: building letter drops off, areas and rooms keep their code', () => {
  assert.deepEqual(splitBinCode('j-row-r'), { code: 'J-ROW-R', prefix: 'J', subLocation: 'ROW-R' });
  assert.deepEqual(splitBinCode('B7-SH-A'), { code: 'B7-SH-A', prefix: 'B7', subLocation: 'B7-SH-A' });
  assert.equal(splitBinCode('B7-DEFAULT').subLocation, 'B7');
  assert.equal(splitBinCode('R3-SH-H').subLocation, 'R3-SH-H');
  assert.equal(splitBinCode('J-DEFAULT').subLocation, '');
  assert.equal(splitBinCode('C3-OTHER').subLocation, 'C3');
  assert.equal(splitBinCode('L-SH-B-1').subLocation, 'SH-B-1');
  for (const notAPlace of ['OTHER', 'RAW PCB', 'DESIGNING']) assert.equal(splitBinCode(notAPlace).subLocation, '');
});

test('prefixes map to sections and warehouses; rooms and storage rooms are in Section A', () => {
  const none = [];
  const expect = { J: 'WAREHOUSE J', I: 'WAREHOUSE I', K: 'WAREHOUSE K', L: 'WAREHOUSE L', B: 'SECTION B', B7: 'SECTION B', C2: 'SECTION C', D: 'SECTION D', A: 'SECTION A', R3: 'SECTION A', S1: 'SECTION A' };
  for (const [prefix, name] of Object.entries(expect)) assert.deepEqual(suggestPrefixChoice(prefix, none), { kind: 'new', name }, prefix);
  assert.deepEqual(suggestPrefixChoice('OTHER', none), { kind: 'skip' });
  assert.equal(suggestPrefixChoice('RAW PCB', none), undefined);
  const switched = [{ id: 'wh-j', name: 'WAREHOUSE J' }, { id: 'prod', name: 'PROD' }];
  assert.deepEqual(suggestPrefixChoice('J', switched), { kind: 'existing', locationId: 'wh-j' });
  assert.deepEqual(suggestPrefixChoice('RAW PCB', switched, 'prod'), { kind: 'existing', locationId: 'prod' });
});

test('import plan adds only missing bins, creates new locations, sets bins, and lists parts the app lacks', () => {
  const { lines } = parseSageFile('sage.xlsx', workbook);
  const locations = [{ id: 'wh-j', name: 'WAREHOUSE J', subLocations: ['LOFT-1'] }, { id: 'sec-c', name: 'SECTION C' }];
  const choices = {
    J: { kind: 'existing', locationId: 'wh-j' },
    C3: { kind: 'existing', locationId: 'sec-c' },
    B4: { kind: 'new', name: 'Section B' },
    OTHER: { kind: 'skip' },
  };
  const stock = [
    { itemId: '563-20-1055', locationId: 'wh-j', quantity: 4, source: 'OH', subLocationDetail: 'LOFT-1', docId: '563-20-1055_wh-j' },
  ];
  const plan = buildSageImportPlan(lines, locations, choices, new Set(['563-20-1000', '563-20-1055']), stock);
  assert.deepEqual(plan.unplacedPrefixes, ['S1']);
  assert.deepEqual(plan.newLocations, [{ id: 'section-b', name: 'SECTION B' }]);
  assert.deepEqual(plan.addSubLocations, [
    { locationId: 'section-b', locationName: 'SECTION B', names: ['B4-SH-F'] },
    { locationId: 'sec-c', locationName: 'SECTION C', names: ['C3'] },
    { locationId: 'wh-j', locationName: 'WAREHOUSE J', names: ['LOFT-2'] },
  ]);
  assert.deepEqual(plan.itemUpdates.map(u => [u.itemId, u.sageQty, u.sageOnPO]), [['563-20-1000', 1840, 1000], ['563-20-1055', -16, 0]]);
  assert.deepEqual(plan.notInApp.map(l => l.itemId), ['NEW-PART']);
  assert.deepEqual(plan.prefixMap, { J: 'wh-j', C3: 'sec-c', B4: 'section-b', OTHER: '' });
  // 563-20-1055's primary bin is S1-SH-D (unplaced), so no bin change; nothing else has stock in a mapped building.
  assert.deepEqual(plan.binUpdates, []);
  const placed = buildSageImportPlan(lines, locations, { ...choices, S1: { kind: 'existing', locationId: 'wh-j' } }, new Set(['563-20-1055']), stock);
  assert.deepEqual(placed.binUpdates, [{ docId: '563-20-1055_wh-j', itemId: '563-20-1055', locationId: 'wh-j', from: 'LOFT-1', to: 'S1-SH-D' }]);
});
