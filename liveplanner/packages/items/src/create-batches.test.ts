import { describe, expect, it } from 'vitest';
import { ITEM_IMPORT_ID, ITEM_WRITE_BYTES, createBatches, importParts } from './create-batches';

describe('createBatches', () => {
  it('splits at the bulk cap and at the write size, never leaving a write empty', () => {
    const small = Array.from({ length: 450 }, (_, i) => ({ i }));
    expect(createBatches(small).map((b) => b.length)).toEqual([200, 200, 50]);
    expect(createBatches([])).toEqual([]);
    const big = Array.from({ length: 5 }, () => ({ text: 'x'.repeat(2 * 1024 * 1024) }));
    expect(createBatches(big).map((b) => b.length)).toEqual([2, 2, 1]);
    // Room the first write spends elsewhere moves its cards on.
    expect(createBatches(big, 4 * 1024 * 1024).map((b) => b.length)).toEqual([0, 2, 2, 1]);
    expect(createBatches(big, ITEM_WRITE_BYTES - 3 * 1024 * 1024).map((b) => b.length)).toEqual([
      1, 2, 2,
    ]);
  });
});

describe('importParts', () => {
  it('numbers each write as a part of one import', () => {
    const cards = Array.from({ length: 450 }, (_, i) => ({ i }));
    expect(
      importParts('import-1', cards).map((p) => [p.importId, p.part, p.parts, p.items.length]),
    ).toEqual([
      ['import-1', 0, 3, 200],
      ['import-1', 1, 3, 200],
      ['import-1', 2, 3, 50],
    ]);
    expect(importParts('import-1', [])).toEqual([]);
  });

  it('takes the ids a client mints, and no others', () => {
    expect(ITEM_IMPORT_ID.test(crypto.randomUUID())).toBe(true);
    expect(ITEM_IMPORT_ID.test('short')).toBe(false);
    expect(ITEM_IMPORT_ID.test('has spaces in it')).toBe(false);
  });
});
