// An items op cut to the room's frame size (docs/specs/026-plan/blueprints/item-store.md "Live: room op"; Work
// Tracker 986).
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_FIELDS_BYTES, type Item } from '@liveplanner/items';
import { ROOM_FRAME_MAX_BYTES, type ItemsRoomOp } from '@liveplanner/api-schema';
import { isItemsOp, jsonBytes, splitItemsOp } from './items-op-split';

const card = (n: number, bytes: number) =>
  ({ id: `id${n}`, key: n, rev: 1, fields: { title: 'x'.repeat(bytes) } }) as unknown as Item;
const op = (upserts: Item[], removed: string[] = []): ItemsRoomOp => ({
  kind: 'items',
  upserts,
  removed,
  rev: 4,
});
const bytesOf = (o: ItemsRoomOp) => jsonBytes(JSON.stringify(o));

describe('splitItemsOp', () => {
  it('answers an op that fits whole, the same object', () => {
    const small = op([card(1, 10)], ['a']);
    expect(splitItemsOp(small, 1_000)).toEqual([small]);
    expect(splitItemsOp(small, 1_000)[0]).toBe(small);
  });

  it('keeps the order, upserts then removals, every part under the size and at the rev', () => {
    const whole = op(
      Array.from({ length: 10 }, (_, n) => card(n, 100)),
      ['r1', 'r2', 'r3'],
    );
    const parts = splitItemsOp(whole, 400);
    expect(parts.length).toBeGreaterThan(3);
    for (const p of parts) {
      expect(bytesOf(p)).toBeLessThanOrEqual(400);
      expect(p.rev).toBe(4);
      expect(p.upserts.length + p.removed.length).toBeGreaterThan(0);
    }
    expect(parts.flatMap((p) => p.upserts)).toEqual(whole.upserts);
    expect(parts.flatMap((p) => p.removed)).toEqual(whole.removed);
  });

  it('puts a change larger than a part alone in a part of its own', () => {
    const parts = splitItemsOp(op([card(1, 50), card(2, 900), card(3, 50)]), 300);
    expect(parts.map((p) => p.upserts.map((i) => i.id))).toEqual([['id1'], ['id2'], ['id3']]);
  });

  it('cuts removals alone too, counting UTF-8 bytes', () => {
    const ids = Array.from({ length: 40 }, (_, n) => `é-${n}`);
    const parts = splitItemsOp(op([], ids), 200);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytesOf(p)).toBeLessThanOrEqual(200);
    expect(parts.flatMap((p) => p.removed)).toEqual(ids);
  });

  it('splits 200 full cards (about 12.5 MiB) within a CPU budget', () => {
    const whole = op(Array.from({ length: 200 }, (_, n) => card(n, ITEM_FIELDS_BYTES)));
    const run = () => void splitItemsOp(whole, ROOM_FRAME_MAX_BYTES);
    run();
    // Measured 2026-11-17: 31 ms on a loaded machine (each card serialised and encoded once); the frames the room then
    // sends serialise the same bytes again.
    const spent = cpuMsOf(run);
    console.info(`[items-op-split] 200 full cards: ${spent.toFixed(1)} ms`);
    expect(spent).toBeLessThan(cpuBudgetMs(200));
    expect(splitItemsOp(whole, ROOM_FRAME_MAX_BYTES)).toHaveLength(14);
  });
});

describe('isItemsOp', () => {
  it('knows an items op from anything else', () => {
    expect(isItemsOp(op([]))).toBe(true);
    expect(isItemsOp({ kind: 'items', upserts: [] })).toBe(false);
    expect(isItemsOp({ kind: 'threads', upserts: [], removed: [] })).toBe(false);
    expect(isItemsOp(null)).toBe(false);
  });
});
