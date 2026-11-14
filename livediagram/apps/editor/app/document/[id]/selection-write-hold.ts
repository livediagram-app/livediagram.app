import type { Element, Tab } from '@livediagram/document';
import { isOwnWriteHeld, type OwnElementWrites } from './own-element-writes';

// The selection lock lasts until our change lands (docs/specs/007-editor/editor-app.md "Held until the holder's change
// lands", Work Tracker 659). Letting go of an element we just changed does not free it for peers at once: the autosave
// still has to write the tab and the room to order its element ops, and a peer who opened the element in that window
// had their edit replaced by our whole-element write. So an element we let go of keeps being sent as held while it
// differs from the save baseline (not saved yet) or its save waits for the room (`own-element-writes.ts`). Pure: the
// presence broadcast (usePresenceBroadcast) owns the timing.

/** Longest an element we let go of stays held, so one whose save keeps failing is never held for good. */
export const WRITE_HOLD_MAX_MS = 10_000;

/** Where "still writing" is read: the tabs on screen, the autosave's baseline and the holds on our saves. */
export type WriteHoldSources = {
  tabs: { readonly current: readonly Tab[] };
  baseline: { readonly current: readonly Tab[] };
  writes: OwnElementWrites;
};

const elementsOf = (tabs: readonly Tab[], tabId: string): Map<string, Element> =>
  new Map((tabs.find((t) => t.id === tabId)?.elements ?? []).map((el) => [el.id, el]));

const sameElement = (a: Element, b: Element) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Which of `ids` on `tabId` this editor is still writing: changed since the save baseline, or held by a save the room
 * has not sequenced. An element no longer on screen is not (a remove is never held). Reads each tab once.
 */
export function stillWritingIds(
  ids: Iterable<string>,
  tabId: string,
  src: WriteHoldSources,
): Set<string> {
  const out = new Set<string>();
  let shown: Map<string, Element> | null = null;
  let saved: Map<string, Element> | null = null;
  for (const id of ids) {
    if (isOwnWriteHeld(src.writes, tabId, id)) {
      out.add(id);
      continue;
    }
    shown ??= elementsOf(src.tabs.current, tabId);
    const now = shown.get(id);
    if (!now) continue;
    saved ??= elementsOf(src.baseline.current, tabId);
    const was = saved.get(id);
    if (!was || !sameElement(now, was)) out.add(id);
  }
  return out;
}

/**
 * The elements we let go of and still hold, after a selection change or a hold's release: `held` (each id with when it
 * was let go) gains the ids `previous` had and `current` does not that we are still writing, loses the ones the
 * selection took back, the ones whose change has landed and the ones held past `WRITE_HOLD_MAX_MS`. A new map; the
 * SAME map when nothing changes.
 */
export function nextWriteHolds(
  held: ReadonlyMap<string, number>,
  previous: ReadonlySet<string>,
  current: ReadonlySet<string>,
  tabId: string,
  src: WriteHoldSources,
  now: number,
): ReadonlyMap<string, number> {
  const letGo = [...previous].filter((id) => !current.has(id) && !held.has(id));
  if (letGo.length === 0 && held.size === 0) return held;
  const candidates = [...letGo, ...[...held.keys()].filter((id) => !current.has(id))];
  const writing = stillWritingIds(candidates, tabId, src);
  const next = new Map<string, number>();
  for (const [id, since] of held) {
    if (!current.has(id) && writing.has(id) && now - since < WRITE_HOLD_MAX_MS) next.set(id, since);
  }
  for (const id of letGo) if (writing.has(id)) next.set(id, now);
  if (next.size === held.size && [...next.keys()].every((id) => held.has(id))) return held;
  return next;
}
