// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate (group-aware via duplicateGroupedElements) and the
// marquee-cluster duplicate that clones boxed elements + arrows and
// re-pins copied endpoints onto the copies. The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import {
  duplicateGroupedElements,
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

export function useElementDuplication(deps: {
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  activeTab: Tab;
  memberIdsOf: (id: string | null) => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
}) {
  const {
    selectedId,
    multiSelectedIds,
    activeTab,
    memberIdsOf,
    commit,
    setSelectedId,
    setMultiSelectedIds,
  } = deps;

  // Multi-select duplicate: clones every multi-selected boxed element
  // with a small diagonal offset, then clones every multi-selected
  // arrow and rewires pinned endpoints onto the new boxed copies
  // when the source was also duplicated. Pinned ends that referenced
  // an element OUTSIDE the selection keep pointing at the original
  // (user can rewire); free ends shift by the same offset so the
  // visual layout of the duplicated cluster matches the source.
  const duplicateMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    track('Element', 'Duplicated');
    const offset = 24;
    const boxedSources = activeTab.elements.filter(
      (el): el is BoxedElement => multiSelectedIds.has(el.id) && isBoxed(el),
    );
    const arrowSources = activeTab.elements.filter(
      (el): el is ArrowElement => multiSelectedIds.has(el.id) && el.type === 'arrow',
    );
    if (boxedSources.length === 0 && arrowSources.length === 0) return;
    const boxedIdMap = new Map<string, string>();
    const boxedCopies: BoxedElement[] = boxedSources.map((s) => {
      const newId = crypto.randomUUID();
      boxedIdMap.set(s.id, newId);
      return {
        ...s,
        id: newId,
        x: s.x + offset,
        y: s.y + offset,
        // Drop group membership — duplicates are independent.
        groupId: undefined,
      };
    });
    const remapEndpoint = (e: ArrowElement['from']): ArrowElement['from'] => {
      if (e.kind === 'pinned') {
        const next = boxedIdMap.get(e.elementId);
        if (next) return { ...e, elementId: next };
        return e;
      }
      // Connected to another arrow's line (spec/50): keep the copy attached to
      // the same line (arrow ids aren't remapped in this boxed-only copy path).
      if (e.kind === 'on-arrow') return e;
      // Pinned to a group's union box (spec/09): the group persists, so the
      // copy stays pinned to it.
      if (e.kind === 'pinned-group') return e;
      return { kind: 'free', x: e.x + offset, y: e.y + offset };
    };
    const arrowCopies: ArrowElement[] = arrowSources.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      from: remapEndpoint(s.from),
      to: remapEndpoint(s.to),
    }));
    const copies: Element[] = [...boxedCopies, ...arrowCopies];
    commit((els) => [...els, ...copies]);
    setMultiSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    track('Element', 'Duplicated');
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = 24;
    if (isBoxed(source)) {
      // Group-aware: if the source belongs to a group, duplicate
      // every group member together with a fresh shared groupId
      // and remapped element ids. duplicateGroupedElements keeps
      // any arrows between the group members re-pinned to the
      // copies. A single-element selection (no group) returns the
      // source element only, which is the original behaviour.
      const ids = memberIdsOf(source.id);
      if (ids.size > 1) {
        const { newElements, idMap } = duplicateGroupedElements(
          activeTab.elements,
          ids,
          offset,
          offset,
        );
        const sourceCopyId = idMap.get(source.id);
        commit((els) => [...els, ...newElements]);
        if (sourceCopyId) setSelectedId(sourceCopyId);
        return;
      }
      const copy: BoxedElement = {
        ...source,
        id: crypto.randomUUID(),
        x: source.x + offset,
        y: source.y + offset,
        // Drop group membership: the duplicate is independent.
        groupId: undefined,
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
      return;
    }
    if (source.type === 'arrow') {
      // For arrows, shift any free endpoints; pinned endpoints stay attached
      // to the same shape. The duplicate represents an extra arrow with the
      // same connection pattern as the original.
      const shift = (e: typeof source.from) =>
        e.kind === 'free' ? { ...e, x: e.x + offset, y: e.y + offset } : e;
      const copy: ArrowElement = {
        ...source,
        id: crypto.randomUUID(),
        from: shift(source.from),
        to: shift(source.to),
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
    }
  };

  return { duplicateSelected, duplicateMultiSelected };
}
