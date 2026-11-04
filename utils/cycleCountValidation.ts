import type { CycleCountSession } from '../types';

/** Approval must apply exactly the values the reviewer read. */
export function assertCountUnchanged(submitted: CycleCountSession, current: CycleCountSession): void {
  if (current.locationId !== submitted.locationId ||
      !Array.isArray(current.lines) || current.lines.length !== submitted.lines.length ||
      current.lines.some((line, index) => {
        const expected = submitted.lines[index];
        return line.itemId !== expected.itemId || line.bookQty !== expected.bookQty ||
          line.countedQty !== expected.countedQty || line.subLocationDetail !== expected.subLocationDetail;
      })) {
    throw new Error('Count changed during review; refresh before approving.');
  }
}
