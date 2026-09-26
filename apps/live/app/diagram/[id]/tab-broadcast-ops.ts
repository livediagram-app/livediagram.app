import {
  diffToElementOps,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  mergeIncomingVote,
  preferNewerQa,
  type Tab,
} from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';

// Turn the before/after of an autosaved tab into the realtime ops to
// broadcast (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0). The room used to send the whole `Tab` on
// every edit, so two people editing *different* elements on the same tab
// clobbered each other. Here we ship only what changed: a `tab-meta` patch
// for non-element fields + one `el` op per changed element, applied by id
// on the receiver so different-element edits merge.

// Above this many element ops for one tab, the change is treated as "bulk"
// (a paste of many elements, a theme repaint, a reset-canvas) and broadcast
// as a single whole-`tab` op instead of a flood of `el` ops: it's cheaper on
// the wire and the receiver replaces the tab wholesale anyway. Below it, the
// granular ops are what let concurrent different-element edits merge.
export const EL_OP_BROADCAST_LIMIT = 20;

// Tab keys that never ride a `tab-meta` patch: `id` is immutable, `elements`
// travels as `el` ops, and `folder` is owned by the diagram-meta op (docs/specs/006-diagram/tab-folders.md)
// so a content/meta edit can't clobber a concurrent folder move.
export const META_SKIP: ReadonlySet<string> = new Set(['id', 'elements', 'folder']);

// Is this `vote` change nothing but dots moving?
//
// A dot travels as its own commutative `vote` op now (docs/specs/012-collaboration/session-tools.md), so shipping the
// votes map in a tab-meta patch as well would put back the very clobber the op
// exists to remove: the patch replaces the field wholesale, so a peer applying
// it would drop any dot that reached them from somebody else in the meantime.
//
// Every other change to `vote` is a LIFECYCLE event — start, end, reveal,
// clear, or stepping the results walkthrough — and each of those moves at least
// one field besides `votes`. Those are the host's alone (`isVoteHost`), so
// there is exactly one writer and carrying the whole object is right for them.
// Hence the rule: `votes` changing ALONE is dots and is left to the op;
// `votes` changing alongside anything else is a lifecycle event and travels
// whole, votes map included (which is also how a start or a clear resets it).
function voteChangeIsDotsOnly(before: unknown, after: unknown): boolean {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return false;
  const { votes: _b, ...restBefore } = before as { votes?: unknown };
  const { votes: _a, ...restAfter } = after as { votes?: unknown };
  return JSON.stringify(restBefore) === JSON.stringify(restAfter);
}

function tabMetaPatch(before: Tab, after: Tab): Partial<Omit<Tab, 'elements'>> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (META_SKIP.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    // A stable JSON compare is correct and cheap here. It used to be justified
    // by "tab meta fields are all plain scalars/enums", which was never true of
    // `vote` — a nested map every participant writes at once — and that gap is
    // what let concurrent dots clobber each other. The compare stays; `vote`
    // now gets the extra rule below. A key present in `before` but gone in `after`
    // yields `patch[k] = undefined`; the caller moves it into the op's `clear`
    // list, because JSON.stringify drops undefined-valued keys on the wire, so
    // a cleared field could never propagate as a patch value.
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    // Dots are the one tab-meta field with many concurrent writers, and they
    // have their own op. See voteChangeIsDotsOnly.
    if (k === 'vote' && voteChangeIsDotsOnly(b, a)) continue;
    patch[k] = a;
  }
  return patch as Partial<Omit<Tab, 'elements'>>;
}

// Derive the room ops to broadcast for a tab autosave just persisted, given
// the last state peers saw (`before`) and the saved state (`after`):
//   - no `before` (a tab peers don't have yet) → one whole-`tab` op;
//   - a bulk element change (> EL_OP_BROADCAST_LIMIT ops) → one whole-`tab` op;
//   - otherwise → a `tab-meta` patch (only if meta changed) followed by one
//     `el` op per changed element, in the diff's order.
export function tabBroadcastOps(before: Tab | undefined, after: Tab): RoomOp[] {
  if (!before) return [{ kind: 'tab', tabId: after.id, tab: after }];

  // An element whose only change rode a delta (an answer, an idea, a tick, a
  // comment: docs/specs/012-collaboration/collab-race-hardening.md) has already been said; a whole-element update on top
  // would hand every receiver a snapshot to be wrong with.
  const beforeById = new Map(before.elements.map((e) => [e.id, e]));
  const elOps = diffToElementOps(before.elements, after.elements).filter((op) => {
    if (op.kind !== 'update') return true;
    const prev = beforeById.get(op.element.id);
    return !prev || !elementChangeIsDeltaOnly(prev, op.element);
  });
  if (elOps.length > EL_OP_BROADCAST_LIMIT) {
    return [{ kind: 'tab', tabId: after.id, tab: after }];
  }

  const ops: RoomOp[] = [];
  const patch = tabMetaPatch(before, after) as Record<string, unknown>;
  const patchKeys = Object.keys(patch);
  if (patchKeys.length > 0) {
    // A cleared field is `patch[k] = undefined`, which JSON.stringify drops,
    // so the clear travels by NAME in `clear` (docs/specs/012-collaboration/collab-race-hardening.md). It used to force a
    // whole-`tab` op, and Clear Timer / Clear Vote then replaced every element
    // on every receiver, wiping their unsaved presses.
    const clear = patchKeys.filter((k) => patch[k] === undefined);
    for (const k of clear) delete patch[k];
    ops.push({
      kind: 'tab-meta',
      tabId: after.id,
      patch: patch as Partial<Omit<Tab, 'elements'>>,
      ...(clear.length ? { clear } : {}),
    });
  }
  for (const op of elOps) ops.push({ kind: 'el', tabId: after.id, op });
  return ops;
}

// Fold a peer's whole `vote` object into ours, wherever one arrives (a
// tab-meta patch or a whole-tab op). A round-stamped vote follows the round
// rule (`mergeIncomingVote`, docs/specs/012-collaboration/collab-race-hardening.md): within one round only delta ops move
// the dots, so the receiver keeps its map. A vote from before rounds keeps the
// older rule: the map is ours unless something besides the dots changed.
export function mergeRemoteVote(local: Tab['vote'], incoming: Tab['vote']): Tab['vote'] {
  if (local?.round !== undefined && incoming?.round !== undefined) {
    return mergeIncomingVote(local, incoming);
  }
  return voteChangeIsDotsOnly(local, incoming) ? local : incoming;
}

// Apply a peer's whole-`tab` op over our copy of that tab.
//
// `folder` is per-diagram link metadata owned by the diagram-meta op (docs/specs/006-diagram/tab-folders.md),
// so the local membership stays and a content edit can't clobber a concurrent
// folder change.
//
// Dots stay ours too. The whole-tab op is the fallback for a new tab or a bulk
// element change (see tabBroadcastOps), and it carries the sender's votes
// map as it stood at their autosave, without any dot still in flight. Every dot
// reaches us as its own `vote` op, so our map is already the merged one; only a
// new round or a clear replaces it (mergeRemoteVote).
//
// And the same for every element's delta-carried fields (answers, ideas,
// ticks, comments: docs/specs/012-collaboration/collab-race-hardening.md), which reached us one delta at a time.
export function mergeRemoteTab(local: Tab, incoming: Tab): Tab {
  const vote = mergeRemoteVote(local.vote, incoming.vote);
  const { vote: _incomingVote, ...rest } = incoming;
  const localById = new Map(local.elements.map((e) => [e.id, e]));
  const elements = incoming.elements.map((el) => {
    const mine = localById.get(el.id);
    // Delta-carried fields stay ours (docs/specs/012-collaboration/collab-race-hardening.md); a Q&A board keeps the newer
    // rev's notes (docs/specs/012-collaboration/qa-board.md), the same rule as an `el` op.
    return mine ? preferNewerQa(mine, mergeIncomingElement(mine, el)) : el;
  });
  return {
    ...rest,
    elements,
    folder: local.folder,
    ...(vote !== undefined ? { vote } : {}),
  };
}
