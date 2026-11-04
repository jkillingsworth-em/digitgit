import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCountUnchanged } from '../utils/cycleCountValidation.ts';

const submitted = { locationId: 'test-a', lines: [{ itemId: 'TEST-LED', bookQty: 20, countedQty: 18, subLocationDetail: 'BIN 1' }] };

test('unchanged count may proceed to stock validation', () => {
  assert.doesNotThrow(() => assertCountUnchanged(submitted, structuredClone(submitted)));
});

test('same-size count edits cannot slip through review', () => {
  for (const patch of [{ itemId: 'OTHER' }, { bookQty: 21 }, { countedQty: 99 }, { subLocationDetail: 'BIN 2' }]) {
    const current = structuredClone(submitted);
    Object.assign(current.lines[0], patch);
    assert.throws(() => assertCountUnchanged(submitted, current), /Count changed during review/);
  }
});

test('location changes and removed count lines invalidate review', () => {
  assert.throws(() => assertCountUnchanged(submitted, { ...submitted, locationId: 'test-b' }), /Count changed/);
  assert.throws(() => assertCountUnchanged(submitted, { ...submitted, lines: [] }), /Count changed/);
});
