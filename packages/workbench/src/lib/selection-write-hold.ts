import { isOwnWriteHeld, onOwnWritesReleased, type OwnWrites } from './own-writes';
import type { Selection, SelectionStore } from './selection-store';

// The selection lock lasts until our change lands (docs/specs/007-editor/editor-app.md "Held until the holder's change
// lands" in every product; livedesign's is live-app.md). Letting go of an element we just changed does not free it for
// peers at once: the autosave still has to write the tab and the room to order its element ops, and a peer who opened
// the element in that window had their edit replaced by our whole-element write. So an element we let go of keeps
// being sent as held while it differs from the save baseline (not saved yet) or its save waits for the room
// (own-writes.ts). Work Tracker 659 built it in livediagram; Work Tracker 862 brought it here for every editor.

/** Longest an element we let go of stays held, so one whose save keeps failing is never held for good. */
export const WRITE_HOLD_MAX_MS = 10_000;

type HoldTab = { readonly id: string; readonly elements?: readonly { readonly id: string }[] };

/** Where "still writing" is read: the tabs on screen, the autosave's baseline and the holds on our saves. */
export type WriteHoldSources = {
  tabs: { readonly current: readonly HoldTab[] };
  baseline: { readonly current: readonly HoldTab[] };
  writes: OwnWrites;
};

// Only the wanted elements of one tab, in one pass: a tab's elements can be large (an article, a table), and only the
// selection's are compared.
function pick(tabs: readonly HoldTab[], tabId: string, wanted: ReadonlySet<string>) {
  const out = new Map<string, unknown>();
  for (const el of tabs.find((t) => t.id === tabId)?.elements ?? []) {
    if (wanted.has(el.id)) out.set(el.id, el);
  }
  return out;
}

const sameElement = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

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
  const rest = new Set<string>();
  for (const id of ids) {
    if (isOwnWriteHeld(src.writes, tabId, id)) out.add(id);
    else rest.add(id);
  }
  if (rest.size === 0) return out;
  const shown = pick(src.tabs.current, tabId, rest);
  if (shown.size === 0) return out;
  const saved = pick(src.baseline.current, tabId, rest);
  for (const [id, now] of shown) {
    const was = saved.get(id);
    if (was === undefined || !sameElement(now, was)) out.add(id);
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

/** The whole selection, as the canvas reads it (the multi-selection plus the primary element), capped at `max`. */
export function selectionIdsOf({ selectedId, multiSelectedIds }: Selection, max: number): string[] {
  const ids = new Set(multiSelectedIds);
  if (selectedId) ids.add(selectedId);
  return [...ids].slice(0, max);
}

export type SelectionBroadcast = {
  selection: SelectionStore;
  /** The tab the selection is on; a tab switch starts a new broadcast, so it starts afresh. */
  tabId: string;
  /** The room's cap on `elementIds` (each product's MAX_SELECTION_IDS). */
  maxIds: number;
  /** Where an element we let go of is read as still being written: absent, the lock ends with the selection. */
  writing?: WriteHoldSources;
  /** Sends one `select` op: the primary element and every id held (none: an empty list). */
  send: (elementId: string | null, elementIds: string[]) => void;
};

/**
 * Sends the selection now, then on every change of it (including to nothing), each element we let go of while our
 * change to it has not landed kept in `elementIds` until it has: a hold's release, or the `WRITE_HOLD_MAX_MS` bound,
 * sends the selection again without it. Returns the function that stops it.
 */
export function broadcastSelection({
  selection,
  tabId,
  maxIds,
  writing,
  send,
}: SelectionBroadcast): () => void {
  let previous = new Set<string>();
  let held: ReadonlyMap<string, number> = new Map();
  let expiry: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const publish = (current: Selection, ids: string[]) => {
    const kept = held.size ? [...held.keys()].filter((id) => !previous.has(id)) : [];
    send(current.selectedId, kept.length ? [...ids, ...kept].slice(0, maxIds) : ids);
  };
  // Re-reads the holds against the selection `ids`; true when they changed.
  const update = (ids: ReadonlySet<string>): boolean => {
    if (!writing) return false;
    const next = nextWriteHolds(held, previous, ids, tabId, writing, Date.now());
    if (next === held) return false;
    held = next;
    if (expiry) clearTimeout(expiry);
    expiry = held.size > 0 ? setTimeout(recheck, WRITE_HOLD_MAX_MS) : null;
    return true;
  };
  const onSelection = () => {
    const current = selection.get();
    const ids = selectionIdsOf(current, maxIds);
    const now = new Set(ids);
    update(now);
    previous = now;
    publish(current, ids);
  };
  // A hold ended or ran out: send the selection again when that frees an element. A release read after the stop
  // (its timer was already queued) does nothing.
  function recheck() {
    if (stopped || held.size === 0) return;
    if (update(previous)) publish(selection.get(), [...previous]);
  }
  onSelection();
  const stopSelection = selection.subscribe(onSelection);
  // Read after the save's own continuation, which moves the baseline the release follows.
  const stopReleases = writing
    ? onOwnWritesReleased(writing.writes, () => void setTimeout(recheck, 0))
    : null;
  return () => {
    stopped = true;
    stopSelection();
    stopReleases?.();
    if (expiry) clearTimeout(expiry);
  };
}
