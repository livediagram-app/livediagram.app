import { diffToElementOps, type Tab } from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';

// Turn the before/after of an autosaved tab into the realtime ops to
// broadcast (spec/75, Level 0). The room used to send the whole `Tab` on
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
// travels as `el` ops, and `folder` is owned by the diagram-meta op (spec/30)
// so a content/meta edit can't clobber a concurrent folder move.
const META_SKIP = new Set(['id', 'elements', 'folder']);

function tabMetaPatch(before: Tab, after: Tab): Partial<Omit<Tab, 'elements'>> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (META_SKIP.has(k)) continue;
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    // Tab meta fields are all plain scalars/enums, so a stable JSON compare
    // is both correct and cheap. A key present in `before` but gone in `after`
    // yields `patch[k] = undefined`; the caller detects that and falls back to
    // a whole-tab op, because JSON.stringify drops undefined-valued keys on
    // the wire, so a cleared field could never propagate as a patch.
    if (JSON.stringify(b) !== JSON.stringify(a)) patch[k] = a;
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

  const elOps = diffToElementOps(before.elements, after.elements);
  if (elOps.length > EL_OP_BROADCAST_LIMIT) {
    return [{ kind: 'tab', tabId: after.id, tab: after }];
  }

  const ops: RoomOp[] = [];
  const patch = tabMetaPatch(before, after);
  const patchKeys = Object.keys(patch);
  if (patchKeys.length > 0) {
    // A cleared field is `patch[k] = undefined`, and JSON.stringify drops
    // undefined-valued keys, so the peer would never see the clear. Fall back
    // to a whole-`tab` op (which carries the field's absence) whenever any
    // field was cleared; ordinary value changes still ride the granular patch.
    if (patchKeys.some((k) => (patch as Record<string, unknown>)[k] === undefined)) {
      return [{ kind: 'tab', tabId: after.id, tab: after }];
    }
    ops.push({ kind: 'tab-meta', tabId: after.id, patch });
  }
  for (const op of elOps) ops.push({ kind: 'el', tabId: after.id, op });
  return ops;
}
