// The room's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md, phase 3).
//
// Every client PUTs whole tabs, and D1 keeps whichever lands last, so a save
// snapshotted before somebody's tick arrived erased it from D1 even though
// the room had it. The Durable Object sequences every `el-delta` op, so it
// records them here, and the api merges the ledger into each save
// before writing. Merging re-applies the entries through `applyElementDelta`,
// so the result is exactly what a peer receiving those deltas would hold.
//
// What is kept is the minimum that reproduces the state, not a log:
//   - ticks: each checklist row's latest state, by index and text;
//   - comments: each one posted (as the room stamped it, see
//     `stampCommentAuthor`), each one removed, and the thread's latest
//     resolve.
//   - a Plan board's set-up (phase 6): the latest value of each top-level
//     field and each column field, each column added or removed, and the
//     latest column order.
//
// Each tick carries the room seq that last set it, and a merge
// only applies what the SAVING client had not yet seen (seq past the cursor it
// sent). Anything it had seen is already in its snapshot, or it changed it
// since: an untick made while its socket was down never reached the room, and
// re-applying the older tick would bring it back.
//
// Pure, and a LEAF module: the DO stores these values, it doesn't interpret
// them.

import type { Tab } from './index';
import type { Comment } from './comments';
import { applyElementDelta, isComment, type ElementDelta } from './element-deltas';
import { CHECKLIST_MAX_TEXT } from './data-shapes';

export type ElementLedger = {
  // Keyed `${index}\u0000${text}`, the row name a `check` delta carries.
  ticks?: Record<string, { done: boolean; seq: number }>;
  // The thread's changes.
  comments?: {
    adds: Record<string, { comment: Comment; seq: number }>;
    removes: Record<string, number>;
    resolved?: { value: boolean; seq: number };
  };
};

export type TabLedger = { elements: Record<string, ElementLedger> };

// Bounds on what one ledger entry may hold, so a flood of hand-crafted ops
// can't grow a room's storage without end. Past a bound, new keys are dropped
// and the merge falls back to what the save carried.
const TICKS_MAX = 200;
const COMMENT_EVENTS_MAX = 500;
const ID_MAX = 200;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

// The storage key an op's ledger entry lives under, or null for an op the
// ledger doesn't track. One key per element so
// no single stored value grows with the size of the canvas.
export function ledgerKey(op: unknown): string | null {
  if (!op || typeof op !== 'object') return null;
  const o = op as { kind?: unknown; tabId?: unknown; elementId?: unknown };
  if (!isStr(o.tabId, ID_MAX)) return null;
  if (o.kind === 'el-delta' && isStr(o.elementId, ID_MAX)) {
    return `ledger:${o.tabId}:el:${o.elementId}`;
  }
  return null;
}

// Every key a tab's ledger may use starts with this.
export function ledgerPrefix(tabId: string): string {
  return `ledger:${tabId}:`;
}

// Record one op into the entry `ledgerKey(op)` names. Returns the new entry,
// or null when the op is malformed or not tracked (the caller then leaves
// storage alone).
export function recordInLedger(
  prev: ElementLedger | undefined,
  op: unknown,
  seq: number,
): ElementLedger | null {
  const o = op as { kind?: unknown };
  if (o.kind === 'el-delta') {
    return recordElement(prev, (op as { delta?: unknown }).delta, seq);
  }
  return null;
}

function recordElement(
  prev: ElementLedger | undefined,
  delta: unknown,
  seq: number,
): ElementLedger | null {
  if (!delta || typeof delta !== 'object') return null;
  const d = delta as Record<string, unknown>;
  switch (d.kind) {
    case 'check': {
      if (typeof d.index !== 'number' || !Number.isInteger(d.index) || d.index < 0) return null;
      if (!isStr(d.text, CHECKLIST_MAX_TEXT) || typeof d.done !== 'boolean') return null;
      const key = `${d.index}\u0000${d.text}`;
      const ticks = prev?.ticks ?? {};
      if (!(key in ticks) && Object.keys(ticks).length >= TICKS_MAX) return null;
      return { ...(prev ?? {}), ticks: { ...ticks, [key]: { done: d.done, seq } } };
    }
    case 'comment-add':
    case 'comment-remove':
    case 'comment-resolve': {
      const comments = prev?.comments ?? { adds: {}, removes: {} };
      const events = Object.keys(comments.adds).length + Object.keys(comments.removes).length;
      if (d.kind === 'comment-add') {
        if (!isComment(d.comment)) return null;
        const id = d.comment.id;
        if (id in comments.removes || id in comments.adds) return null;
        if (events >= COMMENT_EVENTS_MAX) return null;
        const add = { comment: d.comment, seq };
        return {
          ...(prev ?? {}),
          comments: { ...comments, adds: { ...comments.adds, [id]: add } },
        };
      }
      if (d.kind === 'comment-remove') {
        if (!isStr(d.commentId, ID_MAX)) return null;
        if (events >= COMMENT_EVENTS_MAX && !(d.commentId in comments.adds)) return null;
        const { [d.commentId]: _gone, ...adds } = comments.adds;
        return {
          ...(prev ?? {}),
          comments: { ...comments, adds, removes: { ...comments.removes, [d.commentId]: seq } },
        };
      }
      if (typeof d.resolved !== 'boolean') return null;
      return {
        ...(prev ?? {}),
        comments: { ...comments, resolved: { value: d.resolved, seq } },
      };
    }
    default:
      return null;
  }
}

// Assemble a tab's ledger from its stored entries (keys under ledgerPrefix).
export function tabLedgerFrom(tabId: string, entries: Iterable<[string, unknown]>): TabLedger {
  const prefix = ledgerPrefix(tabId);
  const ledger: TabLedger = { elements: {} };
  for (const [key, value] of entries) {
    if (!key.startsWith(prefix) || !value || typeof value !== 'object') continue;
    const rest = key.slice(prefix.length);
    if (rest.startsWith('el:')) ledger.elements[rest.slice(3)] = value;
  }
  return ledger;
}

// Fold the ledger into a tab a client is saving, given the room seq that
// client had caught up to (`since`). Everything the save carries stays, except
// where the room knows something the saver didn't: ticks set after `since` are
// re-applied, and thread changes after `since` replayed.
export function mergeLedgerIntoTab(tab: Tab, ledger: TabLedger, since: number): Tab {
  let changed = false;
  const elements = tab.elements.map((el) => {
    const entry = ledger.elements[el.id];
    if (!entry) return el;
    // A thread can sit on any boxed element, not only a shape.
    let next = applyCommentEvents(el, entry, since);
    if (el.type !== 'shape') {
      if (next !== el) changed = true;
      return next;
    }
    for (const [key, tick] of Object.entries(entry.ticks ?? {})) {
      if (tick.seq <= since) continue;
      const done = tick.done;
      const cut = key.indexOf('\u0000');
      next = applyElementDelta(next, {
        kind: 'check',
        index: Number(key.slice(0, cut)),
        text: key.slice(cut + 1),
        done,
      }) as typeof el;
    }
    if (next !== el) changed = true;
    return next;
  });
  return changed ? { ...tab, elements } : tab;
}

// The thread changes the saver hadn't seen, in the order the room took them,
// so an add after a resolve re-opens the thread and a resolve after it closes
// it again, exactly as it went live. Comments aren't a shape field, so this
// runs for any element kind that carries a thread.
function applyCommentEvents<E extends Tab['elements'][number]>(
  el: E,
  entry: ElementLedger,
  since: number,
): E {
  const c = entry.comments;
  if (!c) return el;
  const events: { seq: number; delta: ElementDelta }[] = [];
  for (const { comment, seq } of Object.values(c.adds)) {
    if (seq > since) events.push({ seq, delta: { kind: 'comment-add', comment } });
  }
  for (const [commentId, seq] of Object.entries(c.removes)) {
    if (seq > since) events.push({ seq, delta: { kind: 'comment-remove', commentId } });
  }
  if (c.resolved && c.resolved.seq > since) {
    events.push({
      seq: c.resolved.seq,
      delta: { kind: 'comment-resolve', resolved: c.resolved.value },
    });
  }
  events.sort((a, b) => a.seq - b.seq);
  return events.reduce<E>((acc, e) => applyElementDelta(acc, e.delta) as E, el);
}

// The name a comment was posted under, for every comment the room has seen
// posted, by id. The api uses it when a save carries somebody else's comment
// that D1 doesn't have yet: without it the save credited the comment to
// whoever happened to save first (docs/specs/012-collaboration/collab-race-hardening.md).
export function ledgerCommentAuthors(
  ledger: TabLedger,
): Map<string, { authorName: string; authorColor: string }> {
  const out = new Map<string, { authorName: string; authorColor: string }>();
  for (const entry of Object.values(ledger.elements)) {
    for (const { comment } of Object.values(entry.comments?.adds ?? {})) {
      out.set(comment.id, { authorName: comment.authorName, authorColor: comment.authorColor });
    }
  }
  return out;
}
