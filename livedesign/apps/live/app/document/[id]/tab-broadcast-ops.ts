import {
  diffToElementOps,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  type Tab,
} from '@livedesign/document';
import { tabPhotoOps, type RoomOp } from '@livedesign/api-schema';

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
// travels as `el` ops, `photos` as `photo` ops, and `folder` is owned by the document-meta op (docs/specs/006-document/tab-folders.md)
// so a content/meta edit can't clobber a concurrent folder move.
export const META_SKIP: ReadonlySet<string> = new Set([
  'id',
  'elements',
  // Photos travel as `photo` ops, layer by layer (docs/specs/031-photo/photo-store.md "Live sync").
  'photos',
  'folder',
]);

// A whole tab as one op, without its photos: those always travel as `photo` ops, and a receiver
// keeps its own through the merge (mergeRemoteTab).
function wholeTabOp(tab: Tab): RoomOp {
  const { photos: _photos, ...rest } = tab;
  void _photos;
  return { kind: 'tab', tabId: tab.id, tab: rest };
}

function tabMetaPatch(before: Tab, after: Tab): Partial<Omit<Tab, 'elements'>> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (META_SKIP.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    // A stable JSON compare is correct and cheap here. A key present in `before` but gone in `after`
    // yields `patch[k] = undefined`; the caller moves it into the op's `clear`
    // list, because JSON.stringify drops undefined-valued keys on the wire, so
    // a cleared field could never propagate as a patch value.
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    patch[k] = a;
  }
  return patch;
}

// Derive the room ops to broadcast for a tab autosave just persisted, given
// the last state peers saw (`before`) and the saved state (`after`):
//   - no `before` (a tab peers don't have yet) → one whole-`tab` op;
//   - a bulk element change (> EL_OP_BROADCAST_LIMIT ops) → one whole-`tab` op;
//   - otherwise → a `tab-meta` patch (only if meta changed) followed by one
//     `el` op per changed element, in the diff's order.
export function tabBroadcastOps(before: Tab | undefined, after: Tab): RoomOp[] {
  if (!before) return [wholeTabOp(after), ...tabPhotoOps({ id: after.id }, after)];

  // An element whose only change rode a delta (a tick, a comment:
  // docs/specs/012-collaboration/collab-race-hardening.md) has already been said; a whole-element update on top
  // would hand every receiver a snapshot to be wrong with.
  const beforeById = new Map(before.elements.map((e) => [e.id, e]));
  const elOps = diffToElementOps(before.elements, after.elements).filter((op) => {
    if (op.kind !== 'update') return true;
    const prev = beforeById.get(op.element.id);
    return !prev || !elementChangeIsDeltaOnly(prev, op.element);
  });
  if (elOps.length > EL_OP_BROADCAST_LIMIT) {
    return [wholeTabOp(after), ...tabPhotoOps(before, after)];
  }

  const ops: RoomOp[] = [];
  const patch = tabMetaPatch(before, after) as Record<string, unknown>;
  const patchKeys = Object.keys(patch);
  if (patchKeys.length > 0) {
    // A cleared field is `patch[k] = undefined`, which JSON.stringify drops,
    // so the clear travels by NAME in `clear` (docs/specs/012-collaboration/collab-race-hardening.md). It used to force a
    // whole-`tab` op, and a cleared field then replaced every element on every
    // receiver, wiping their unsaved presses.
    const clear = patchKeys.filter((k) => patch[k] === undefined);
    for (const k of clear) delete patch[k];
    ops.push({
      kind: 'tab-meta',
      tabId: after.id,
      patch: patch,
      ...(clear.length ? { clear } : {}),
    });
  }
  for (const op of elOps) ops.push({ kind: 'el', tabId: after.id, op });
  ops.push(...tabPhotoOps(before, after));
  return ops;
}

// Apply a peer's whole-`tab` op over our copy of that tab.
//
// `folder` is per-document link metadata owned by the document-meta op (docs/specs/006-document/tab-folders.md),
// so the local membership stays and a content edit can't clobber a concurrent
// folder change.
//
// Every element's delta-carried fields (ticks, comments: docs/specs/012-collaboration/collab-race-hardening.md) stay
// ours too: they reached us one delta at a time, and the whole-tab op carries the sender's as they stood at their
// autosave.
export function mergeRemoteTab(local: Tab, incoming: Tab): Tab {
  const localById = new Map(local.elements.map((e) => [e.id, e]));
  const elements = incoming.elements.map((el) => {
    const mine = localById.get(el.id);
    // Delta-carried fields stay ours (docs/specs/012-collaboration/collab-race-hardening.md).
    return mine ? mergeIncomingElement(mine, el) : el;
  });
  return {
    ...incoming,
    elements,
    folder: local.folder,
    // Photos are the `photo` ops' alone (wholeTabOp): ours stay through a whole-tab merge.
    ...(local.photos !== undefined ? { photos: local.photos } : {}),
  };
}
