import {
  diffArticleFlow,
  diffToElementOps,
  articlesOf,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  mergeIncomingVote,
  planBoardPatch,
  preferNewerQa,
  type ArticleOp,
  type Tab,
} from '@livediagram/document';
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
// travels as `el` ops, `articles` as `article` ops (docs/specs/007-editor/article-pages.md
// "Collaboration"), and `folder` is owned by the document-meta op (docs/specs/006-document/tab-folders.md)
// so a content/meta edit can't clobber a concurrent folder move.
export const META_SKIP: ReadonlySet<string> = new Set(['id', 'elements', 'articles', 'folder']);

// A whole tab as one op, without its articles' writing: that always travels as `article` ops, so a
// long document never makes a whole-tab op too big for the room to carry, and a receiver keeps its
// own writing through the merge (mergeRemoteTab).
function wholeTabOp(tab: Tab): RoomOp {
  const { articles: _docs, ...rest } = tab;
  void _docs;
  return { kind: 'tab', tabId: tab.id, tab: rest };
}

// The `article` ops for a tab's articles' writing: per article, its block ops, or that it is gone.
// The stored articles are compared by identity first, so an untouched document costs nothing.
export function tabArticleOps(before: Tab, after: Tab): RoomOp[] {
  if (before.articles === after.articles) return [];
  const was = articlesOf(before);
  const now = articlesOf(after);
  const ops: RoomOp[] = [];
  for (const flow of Object.keys(was)) {
    if (!(flow in now)) ops.push({ kind: 'article', tabId: after.id, flow, removed: true });
  }
  for (const [flow, doc] of Object.entries(now)) {
    if (was[flow] === doc) continue;
    // In frames the room will carry (it drops one over 256K characters): ops in order, a frame
    // closing before it would pass ARTICLE_FRAME_CHARS. Applied in order, the frames compose.
    const created = was[flow] ? {} : { created: true as const };
    let frame: ArticleOp[] = [];
    let chars = 0;
    for (const op of diffArticleFlow(was[flow], doc)) {
      const size = JSON.stringify(op).length;
      if (frame.length > 0 && chars + size > ARTICLE_FRAME_CHARS) {
        ops.push({ kind: 'article', tabId: after.id, flow, ops: frame, ...created });
        frame = [];
        chars = 0;
      }
      frame.push(op);
      chars += size;
    }
    if (frame.length > 0)
      ops.push({ kind: 'article', tabId: after.id, flow, ops: frame, ...created });
  }
  return ops;
}

// The most characters of block ops one `article` frame carries: well inside the room's 256K cap on a
// message (apps/api/src/document-room.ts MAX_MESSAGE_CHARS), with room for the envelope.
export const ARTICLE_FRAME_CHARS = 200_000;

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

// One `board` delta per Plan board whose set-up changed (docs/specs/012-collaboration/collab-race-hardening.md,
// phase 6). Derived here rather than at each control, so a column cog, the Board flyout, a widget dropped
// from the palette and undo or redo all reach peers as only what changed.
export function boardDeltaOps(before: Tab, after: Tab): RoomOp[] {
  const beforeById = new Map(before.elements.map((e) => [e.id, e]));
  const ops: RoomOp[] = [];
  for (const el of after.elements) {
    if (el.type !== 'shape' || !el.planBoard) continue;
    const prev = beforeById.get(el.id);
    if (!prev || prev.type !== 'shape' || prev.planBoard === el.planBoard) continue;
    const patch = planBoardPatch(prev.planBoard, el.planBoard);
    if (patch) {
      ops.push({
        kind: 'el-delta',
        tabId: after.id,
        elementId: el.id,
        delta: { kind: 'board', patch },
      });
    }
  }
  return ops;
}

// Derive the room ops to broadcast for a tab autosave just persisted, given
// the last state peers saw (`before`) and the saved state (`after`):
//   - no `before` (a tab peers don't have yet) → one whole-`tab` op;
//   - a bulk element change (> EL_OP_BROADCAST_LIMIT ops) → one whole-`tab` op;
//   - otherwise → a `tab-meta` patch (only if meta changed) followed by one
//     `el` op per changed element, in the diff's order.
export function tabBroadcastOps(before: Tab | undefined, after: Tab): RoomOp[] {
  if (!before)
    return [wholeTabOp(after), ...tabArticleOps({ ...after, articles: undefined }, after)];

  // An element whose only change rode a delta (an answer, an idea, a tick, a
  // comment: docs/specs/012-collaboration/collab-race-hardening.md) has already been said; a whole-element update on top
  // would hand every receiver a snapshot to be wrong with.
  const beforeById = new Map(before.elements.map((e) => [e.id, e]));
  const elOps = diffToElementOps(before.elements, after.elements).filter((op) => {
    if (op.kind !== 'update') return true;
    const prev = beforeById.get(op.element.id);
    return !prev || !elementChangeIsDeltaOnly(prev, op.element);
  });
  // A receiver keeps its own board set-up through a whole-element or whole-tab copy, so the set-up's
  // change goes as its delta on both paths.
  const boardOps = boardDeltaOps(before, after);
  if (elOps.length > EL_OP_BROADCAST_LIMIT) {
    return [wholeTabOp(after), ...boardOps, ...tabArticleOps(before, after)];
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
  ops.push(...boardOps);
  ops.push(...tabArticleOps(before, after));
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
// `folder` is per-document link metadata owned by the document-meta op (docs/specs/006-document/tab-folders.md),
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
    // The writing is the `article` ops' alone (wholeTabOp): ours stays through a whole-tab merge.
    ...(local.articles !== undefined ? { articles: local.articles } : {}),
  };
}
