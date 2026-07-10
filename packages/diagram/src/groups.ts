import { isBoxed, type Anchor, type Element, type ElementId, type Endpoint } from './index';

// --- Layer order -----------------------------------------------------------

export function bringToFront(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [...elements.filter((e) => e.id !== id), el];
}

export function sendToBack(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [el, ...elements.filter((e) => e.id !== id)];
}

export function bringManyToFront(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...others, ...members];
}

export function sendManyToBack(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...members, ...others];
}

// --- Groups ----------------------------------------------------------------

// All element ids that should be treated as one selection when `id` is clicked:
// the element itself, plus any other boxed element with the same groupId.
export function selectionMembers(elements: Element[], id: ElementId): ElementId[] {
  const target = elements.find((el) => el.id === id);
  if (!target) return [];
  if (!isBoxed(target) || !target.groupId) return [target.id];
  const gid = target.groupId;
  return elements.filter((el) => isBoxed(el) && el.groupId === gid).map((el) => el.id);
}

// Union bounding box of multiple boxed elements. Returns null if no boxed
// elements were found.
export function unionBoxedBounds(
  elements: Element[],
  ids: Set<ElementId>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;
  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    found = true;
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.x + el.width > maxX) maxX = el.x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
  }
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Merge the groups containing `sourceId` and `targetId` into one fresh group.
// Returns elements unchanged if either id is missing, non-boxed, or they're
// already in the same group.
export function joinGroups(
  elements: Element[],
  sourceId: ElementId,
  targetId: ElementId,
): Element[] {
  if (sourceId === targetId) return elements;
  const source = elements.find((el) => el.id === sourceId);
  const target = elements.find((el) => el.id === targetId);
  if (!source || !target || !isBoxed(source) || !isBoxed(target)) return elements;
  if (source.groupId && source.groupId === target.groupId) return elements;
  // Prefer source's existing group id when extending an existing group so we
  // don't churn ids on every "Click another element to group it".
  const newGroupId = source.groupId ?? target.groupId ?? crypto.randomUUID();
  // Arrows pinned to either merged group's union box follow the merge:
  // their endpoints re-point at the surviving group id (the union just
  // grows), instead of dangling off a group id that no longer exists.
  const oldIds = new Set(
    [source.groupId, target.groupId].filter((id): id is ElementId => id !== undefined),
  );
  const remap = (ep: Endpoint): Endpoint =>
    ep.kind === 'pinned-group' && oldIds.has(ep.groupId) && ep.groupId !== newGroupId
      ? { ...ep, groupId: newGroupId }
      : ep;
  return elements.map((el) => {
    if (el.type === 'arrow') {
      const from = remap(el.from);
      const to = remap(el.to);
      return from === el.from && to === el.to ? el : { ...el, from, to };
    }
    if (!isBoxed(el)) return el;
    const isSource = el.id === source.id;
    const isTarget = el.id === target.id;
    const inSourceGroup = source.groupId !== undefined && el.groupId === source.groupId;
    const inTargetGroup = target.groupId !== undefined && el.groupId === target.groupId;
    if (isSource || isTarget || inSourceGroup || inTargetGroup) {
      return { ...el, groupId: newGroupId };
    }
    return el;
  });
}

export function ungroup(elements: Element[], groupId: ElementId): Element[] {
  // Freeze arrows pinned to the group's union box (spec/09 group
  // quick-connect) at their last position BEFORE the membership is
  // cleared — afterwards the union bounds no longer exist.
  const frozen = freezeGroupEndpoints(elements, new Set([groupId]));
  return frozen.map((el) => {
    if (!isBoxed(el) || el.groupId !== groupId) return el;
    const { groupId: _drop, ...rest } = el;
    return rest as typeof el;
  });
}

// --- Group-pinned arrow endpoints (spec/09 group quick-connect) -------------

// The live union bounds of every member of `groupId`, or null once the
// group has no members.
export function groupUnionBounds(
  elements: Element[],
  groupId: ElementId,
): { x: number; y: number; width: number; height: number } | null {
  const ids = new Set(
    elements.filter((el) => isBoxed(el) && el.groupId === groupId).map((el) => el.id),
  );
  return ids.size > 0 ? unionBoxedBounds(elements, ids) : null;
}

// The `anchor` point on a plain bounds rectangle — where a pinned-group
// endpoint resolves (side midpoints + corners of the union box).
export function boundsAnchorPoint(
  b: { x: number; y: number; width: number; height: number },
  anchor: Anchor,
): { x: number; y: number } {
  const x = anchor.includes('w') ? b.x : anchor.includes('e') ? b.x + b.width : b.x + b.width / 2;
  const y = anchor.includes('n') ? b.y : anchor.includes('s') ? b.y + b.height : b.y + b.height / 2;
  return { x, y };
}

// Rewrite every pinned-group arrow end referencing one of `groupIds` to a
// FREE endpoint at its current resolved position, using `boundsSource` for
// the bounds (defaults to `elements`; pass the pre-mutation list when the
// members are about to disappear). Used by ungroup and the delete paths so
// an arrow never dangles off a group that no longer exists.
function freezeGroupEndpoints(
  elements: Element[],
  groupIds: ReadonlySet<ElementId>,
  boundsSource: Element[] = elements,
): Element[] {
  if (groupIds.size === 0) return elements;
  const boundsFor = new Map<ElementId, { x: number; y: number; width: number; height: number }>();
  for (const id of groupIds) {
    const b = groupUnionBounds(boundsSource, id);
    if (b) boundsFor.set(id, b);
  }
  const freeze = (ep: Endpoint): Endpoint => {
    if (ep.kind !== 'pinned-group' || !groupIds.has(ep.groupId)) return ep;
    const b = boundsFor.get(ep.groupId);
    if (!b) return ep; // group already gone in both lists: leave as-is
    const p = boundsAnchorPoint(b, ep.anchor);
    return { kind: 'free', x: p.x, y: p.y };
  };
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const from = freeze(el.from);
    const to = freeze(el.to);
    return from === el.from && to === el.to ? el : { ...el, from, to };
  });
}

// After a delete, freeze pinned-group arrow ends whose group lost its last
// member, at the position it had in the PRE-delete list. Pure: takes the
// before/after element lists, returns the adjusted after-list.
export function freezeDanglingGroupEnds(before: Element[], after: Element[]): Element[] {
  const dangling = new Set<ElementId>();
  for (const el of after) {
    if (el.type !== 'arrow') continue;
    for (const ep of [el.from, el.to]) {
      if (ep.kind === 'pinned-group' && groupUnionBounds(after, ep.groupId) === null) {
        dangling.add(ep.groupId);
      }
    }
  }
  return dangling.size > 0 ? freezeGroupEndpoints(after, dangling, before) : after;
}
