// Loading a diagram saved while groups existed (docs/specs/009-elements/web-components-and-no-groups.md).
//
// Groups are gone, but stored tabs still carry their traces: a `groupId` on
// boxed elements, and arrow ends of kind `pinned-group` that resolved to an
// anchor on the union box of every member sharing that id. Neither type
// exists any more, so this runs at the boundaries where stored tabs enter —
// the api worker's `rowToTab` and the offline store's tab load — and hands
// the rest of the code base a tab with no trace of either:
//
// - a `pinned-group` end becomes a FREE end at the point it resolved to, so
//   the arrow stays exactly where it was drawn (it simply no longer follows
//   the members, which are ordinary elements now);
// - `groupId` is dropped.
//
// The validator still accepts the legacy endpoint shape on write, so a
// browser running a cached pre-change build can keep saving. Whatever it
// saves is migrated here on the next read.

import type { Anchor, Element } from './index';

type Box = { x: number; y: number; width: number; height: number };
type LegacyGroupEnd = { kind: 'pinned-group'; groupId: string; anchor: Anchor };

const isLegacyGroupEnd = (ep: unknown): ep is LegacyGroupEnd =>
  typeof ep === 'object' && ep !== null && (ep as { kind?: unknown }).kind === 'pinned-group';

const legacyGroupIdOf = (el: Element): string | undefined => {
  const gid = (el as { groupId?: unknown }).groupId;
  return typeof gid === 'string' ? gid : undefined;
};

// The union box of every element that carried `groupId`, per group.
function groupBoxes(elements: readonly Element[]): Map<string, Box> {
  const out = new Map<string, Box>();
  for (const el of elements) {
    const gid = legacyGroupIdOf(el);
    if (!gid || el.type === 'arrow') continue;
    const prev = out.get(gid);
    if (!prev) {
      out.set(gid, { x: el.x, y: el.y, width: el.width, height: el.height });
      continue;
    }
    const x = Math.min(prev.x, el.x);
    const y = Math.min(prev.y, el.y);
    const right = Math.max(prev.x + prev.width, el.x + el.width);
    const bottom = Math.max(prev.y + prev.height, el.y + el.height);
    out.set(gid, { x, y, width: right - x, height: bottom - y });
  }
  return out;
}

// The anchor point on a box: side midpoints and corners.
function anchorOn(b: Box, anchor: Anchor): { x: number; y: number } {
  const x = anchor.includes('w') ? b.x : anchor.includes('e') ? b.x + b.width : b.x + b.width / 2;
  const y = anchor.includes('n') ? b.y : anchor.includes('s') ? b.y + b.height : b.y + b.height / 2;
  return { x, y };
}

// Whether a tab's elements carry anything to migrate. Cheap, so the common
// case (a diagram that never used groups) returns the same array untouched.
export function hasLegacyGroups(elements: readonly Element[]): boolean {
  return elements.some((el) =>
    el.type === 'arrow'
      ? isLegacyGroupEnd(el.from) || isLegacyGroupEnd(el.to)
      : legacyGroupIdOf(el) !== undefined,
  );
}

export function migrateLegacyGroups(elements: Element[]): Element[] {
  if (!hasLegacyGroups(elements)) return elements;
  const boxes = groupBoxes(elements);
  const freeze = (ep: unknown) => {
    if (!isLegacyGroupEnd(ep)) return ep;
    // A group with no members left resolved to the origin before; keep that
    // rather than invent a position.
    const b = boxes.get(ep.groupId);
    const p = b ? anchorOn(b, ep.anchor) : { x: 0, y: 0 };
    return { kind: 'free' as const, x: p.x, y: p.y };
  };
  return elements.map((el) => {
    if (el.type === 'arrow') {
      if (!isLegacyGroupEnd(el.from) && !isLegacyGroupEnd(el.to)) return el;
      return { ...el, from: freeze(el.from), to: freeze(el.to) } as Element;
    }
    if (legacyGroupIdOf(el) === undefined) return el;
    const { groupId: _drop, ...rest } = el as Element & { groupId?: string };
    return rest as Element;
  });
}
