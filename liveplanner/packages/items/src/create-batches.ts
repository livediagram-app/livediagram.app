// Many cards made at once (docs/specs/026-plan/items.md "Limits"): in writes of at most ITEM_BULK_MAX cards, each
// under the api's request cap, so an import's cards with their comment threads never pass it.
import { ITEM_BULK_MAX } from './limits';

// The most JSON one write of many cards carries: under the api's 8 MB request cap (apps/api limits.ts
// MAX_BODY_BYTES), with room for the rest of the request.
export const ITEM_WRITE_BYTES = 6 * 1024 * 1024;

/** Cards to make, in writes the api takes (an import's, a sync's): each at most ITEM_BULK_MAX cards and ITEM_WRITE_BYTES of JSON (a
 *  card's fields and thread are each capped, so no one card passes it). `firstBytes` is room the first write spends
 *  on something else (a new plan's tab and card types); when that leaves no room, the first write holds no card. */
export function createBatches<T>(creates: readonly T[], firstBytes = 0): T[][] {
  const encoder = new TextEncoder();
  const out: T[][] = [];
  let batch: T[] = [];
  let bytes = firstBytes;
  for (const c of creates) {
    const size = encoder.encode(JSON.stringify(c)).length + 1;
    const full = batch.length >= ITEM_BULK_MAX || bytes + size > ITEM_WRITE_BYTES;
    // A write is closed once full, though it holds no card when the first write's own room filled it.
    if (full && (batch.length > 0 || bytes > 0)) {
      out.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(c);
    bytes += size;
  }
  if (batch.length) out.push(batch);
  return out;
}
