// An `items` op cut to the room's frame size (docs/specs/026-plan/blueprints/item-store.md "Live: room op"; Work
// Tracker 986): a card holds up to 64 KiB, so 200 changed cards make an op of about 12.5 MiB, past the size the room
// sends. The parts keep the op's order (its upserts, then its removals), each carries the write's `rev` and holds at
// least one change, and an op that fits is answered whole.
import type { ItemsRoomOp } from '@liveplanner/api-schema';

const encoder = new TextEncoder();

// The UTF-8 bytes of a JSON text.
export const jsonBytes = (text: string): number => encoder.encode(text).length;

export function isItemsOp(op: unknown): op is ItemsRoomOp {
  const o = op as Partial<ItemsRoomOp> | null;
  return o?.kind === 'items' && Array.isArray(o.upserts) && Array.isArray(o.removed);
}

// The parts, each op's JSON at most `maxBytes` (a change larger than that alone goes in a part of its own).
export function splitItemsOp(op: ItemsRoomOp, maxBytes: number): ItemsRoomOp[] {
  const blank = (): ItemsRoomOp => ({ ...op, upserts: [], removed: [] });
  const empty = jsonBytes(JSON.stringify(blank()));
  // Each change costs its JSON and the comma before the next.
  const upsertBytes = op.upserts.map((i) => jsonBytes(JSON.stringify(i)) + 1);
  const removedBytes = op.removed.map((id) => jsonBytes(JSON.stringify(id)) + 1);
  const sum = (bytes: number[]) => bytes.reduce((a, b) => a + b, 0);
  if (empty + sum(upsertBytes) + sum(removedBytes) <= maxBytes) return [op];
  const parts: ItemsRoomOp[] = [];
  let part = blank();
  let size = empty;
  const add = (bytes: number) => {
    const held = part.upserts.length + part.removed.length;
    if (held > 0 && size + bytes > maxBytes) {
      parts.push(part);
      part = blank();
      size = empty;
    }
    size += bytes;
  };
  op.upserts.forEach((item, n) => {
    add(upsertBytes[n]!);
    part.upserts.push(item);
  });
  op.removed.forEach((id, n) => {
    add(removedBytes[n]!);
    part.removed.push(id);
  });
  parts.push(part);
  return parts;
}
