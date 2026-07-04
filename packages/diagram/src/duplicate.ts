// Selection duplication (spec/09 groups + spec/50 arrow-to-arrow):
// copy a set of elements with fresh ids, preserved-but-remapped group
// membership, and arrows re-pinned to the copies. Split from
// factories.ts so that file stays purely the per-element creation
// factories; re-exported from ./index so the public surface is
// unchanged.

import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
// - Grouping is PRESERVED, not invented: each distinct source `groupId`
//   is remapped to a fresh one, so a duplicated group stays a (distinct)
//   group while loose elements stay loose. A new group left with only one
//   member (e.g. a marquee that caught part of a group) is dropped, so we
//   never mint a lone group. (Previously every multi-element duplication
//   was forced into one shared group, which surprised users pasting a
//   loose marquee selection — see useClipboard.)
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
export function duplicateGroupedElements(
  elements: Element[],
  ids: Set<ElementId>,
  dx: number,
  dy: number,
): { newElements: Element[]; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const newBoxed: BoxedElement[] = [];

  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    const newId = crypto.randomUUID();
    idMap.set(el.id, newId);
    newBoxed.push({ ...el, id: newId, x: el.x + dx, y: el.y + dy });
  }

  // Remap each distinct source groupId to a fresh one so copied groups
  // stay grouped (and distinct from the originals) without welding loose
  // elements together. newBoxed already carries the source groupId via
  // the spread above.
  const groupIdMap = new Map<string, string>();
  const remapped: BoxedElement[] = newBoxed.map((el) => {
    if (el.groupId === undefined) return el;
    let next = groupIdMap.get(el.groupId);
    if (next === undefined) {
      next = crypto.randomUUID();
      groupIdMap.set(el.groupId, next);
    }
    return { ...el, groupId: next };
  });
  // Drop any new group that ended up with a single member — a group of
  // one is degenerate (happens when only part of a source group was in
  // the duplicated set).
  const groupCounts = new Map<string, number>();
  for (const el of remapped) {
    if (el.groupId !== undefined) {
      groupCounts.set(el.groupId, (groupCounts.get(el.groupId) ?? 0) + 1);
    }
  }
  const finalBoxed: Element[] = remapped.map((el) => {
    if (el.groupId !== undefined && (groupCounts.get(el.groupId) ?? 0) < 2) {
      const lone = { ...el };
      delete lone.groupId;
      return lone;
    }
    return el;
  });

  const existingIds = new Set(elements.map((e) => e.id));

  // Decide which arrows copy, and mint their new ids into idMap BEFORE
  // building any copy: an on-arrow endpoint (spec/50) can only follow
  // its target's duplicate if that duplicate's id is already known when
  // the endpoint is remapped. (Minting inline at push time left idMap
  // arrow-less, so every copied arrow-on-arrow connection stayed pinned
  // to the ORIGINAL arrow — or, cross-tab, to a dangling id.)
  // An arrow copies when it's explicitly in the duplicated set, OR when
  // both endpoints pin to elements that were duplicated — the latter is
  // the group / quick-connect case where an internal connector should
  // ride along with its group even if the marquee didn't catch the
  // arrow itself.
  let arrowsToCopy: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const bothEndsDuplicated =
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      idMap.has(el.from.elementId) &&
      idMap.has(el.to.elementId);
    if (!ids.has(el.id) && !bothEndsDuplicated) continue;
    idMap.set(el.id, crypto.randomUUID());
    arrowsToCopy.push(el);
  }

  // Settle droppability to a FIXPOINT before building any copy: an arrow
  // whose endpoint can't resolve (its pin target neither copies nor
  // exists) is dropped, and dropping it can strand another copied
  // arrow's on-arrow endpoint (spec/50) that had already resolved to its
  // duplicate — which would commit an endpoint pointing at an arrow that
  // never gets created (rendered at the canvas origin, then persisted).
  // Repeat until no arrow drops, so every surviving remap is final.
  const endpointResolvable = (end: ArrowElement['from']): boolean => {
    if (end.kind === 'free') return true;
    if (end.kind === 'on-arrow') return idMap.has(end.arrowId) || existingIds.has(end.arrowId);
    // Group-pinned: the referenced group either came along (remapped to the
    // copies' fresh group id) or still exists on the originals — never an
    // orphan either way.
    if (end.kind === 'pinned-group') return true;
    return idMap.has(end.elementId) || existingIds.has(end.elementId);
  };
  for (;;) {
    const surviving = arrowsToCopy.filter(
      (el) => endpointResolvable(el.from) && endpointResolvable(el.to),
    );
    if (surviving.length === arrowsToCopy.length) break;
    for (const el of arrowsToCopy) {
      if (!surviving.includes(el)) idMap.delete(el.id);
    }
    arrowsToCopy = surviving;
  }

  // Re-point one endpoint of a duplicated arrow: a FREE end translates by
  // (dx, dy) so a free-floating arrow copies in place like any boxed
  // element; a PINNED end follows its duplicate when the target was
  // copied, otherwise keeps the original pin (still a real element, so no
  // orphan). A pin to an element that's gone entirely (e.g. a cross-tab
  // paste where the target wasn't carried over) returns null and the
  // whole arrow is skipped rather than left dangling.
  const remapEndpoint = (end: ArrowElement['from']): ArrowElement['from'] | null => {
    if (end.kind === 'free') return { kind: 'free', x: end.x + dx, y: end.y + dy };
    // Group-pinned: when the group's members were copied too, follow the
    // copies' fresh group id; otherwise stay pinned to the original group.
    if (end.kind === 'pinned-group') {
      const dupGroup = groupIdMap.get(end.groupId);
      return dupGroup ? { ...end, groupId: dupGroup } : end;
    }
    // Connected to another arrow's line (spec/50): follow the duplicate when
    // the target arrow was copied too, else keep the original, else drop.
    if (end.kind === 'on-arrow') {
      const dupArrow = idMap.get(end.arrowId);
      if (dupArrow) return { kind: 'on-arrow', arrowId: dupArrow, t: end.t };
      return existingIds.has(end.arrowId) ? end : null;
    }
    const dup = idMap.get(end.elementId);
    // Preserve `manual`: a hand-placed anchor must stay fixed on the
    // copy too, or the auto-rebind re-chooses the face on first move.
    if (dup) {
      return {
        kind: 'pinned',
        elementId: dup,
        anchor: end.anchor,
        ...(end.manual ? { manual: true } : {}),
      };
    }
    return existingIds.has(end.elementId) ? end : null;
  };

  const newArrows: ArrowElement[] = [];
  for (const el of arrowsToCopy) {
    const from = remapEndpoint(el.from);
    const to = remapEndpoint(el.to);
    // A dropped arrow must leave idMap too — callers use the map to
    // select / wire the duplicates, and a phantom id would dangle.
    if (!from || !to) {
      idMap.delete(el.id);
      continue;
    }
    // Spread the source so styling (stroke, ends, dash, arrowhead, curve,
    // label) survives the copy; only the id + endpoints are replaced.
    newArrows.push({ ...el, id: idMap.get(el.id)!, from, to });
  }

  return { newElements: [...finalBoxed, ...newArrows], idMap };
}
