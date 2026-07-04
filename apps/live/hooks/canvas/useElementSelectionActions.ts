// Structural element operations, lifted out of editor-page.tsx.
// Where useElementStyle mutates *fields* on the selection, these
// handlers change the element *set* and/or the selection itself:
// delete, marquee commit, group / ungroup, and the duplicate family
// (single, multi-select, and duplicate-and-connect).
//
// They all run through the page's history-aware `commit`, and most
// also move selection state (setSelectedId / setMultiSelectedIds), so
// the page passes those setters in. Verbatim relocation — no
// behaviour change.

import {
  freezeDanglingGroupEnds,
  createText,
  duplicateGroupedElements,
  isBoxed,
  ungroup,
  unionBoxedBounds,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import {
  arrowReferencesAny,
  type QuickConnectDirection,
  type QuickConnectKind,
} from '@/lib/canvas';
import { quickAddPlacement } from '@/lib/quick-add-placement';
import { track, titleCaseType } from '@/lib/telemetry';

type EditorSelectionActionsDeps = {
  // The active selection resolved to ids (single selection expands to
  // its group; multi-select returns the marquee bag).
  currentSelectionIds: () => Set<string>;
  // Group members of an element id (the element alone when ungrouped).
  // Drives the group-aware duplicate paths.
  memberIdsOf: (id: string | null) => Set<string>;
  // The single-selected element id (null in multi-select / none).
  selectedId: string | null;
  // The marquee multi-selection bag.
  multiSelectedIds: Set<string>;
  // The active tab — read for its element list.
  activeTab: Tab;
  // History-aware element mutator (snapshots + emits the log).
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  setFormatSourceId: (id: string | null) => void;
  setGroupSourceId: (id: string | null) => void;
  // True when another participant has the element selected (concurrent-
  // selection lock, spec/07). A marquee skips locked elements so a drag
  // box doesn't scoop up something someone else is editing.
  lockedByOther: (id: string) => boolean;
};

export function useElementSelectionActions(deps: EditorSelectionActionsDeps) {
  const {
    currentSelectionIds,
    memberIdsOf,
    selectedId,
    multiSelectedIds,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    setGroupSourceId,
    lockedByOther,
  } = deps;

  const deleteSelected = () => {
    // A locked tab protects everything on it — nothing is deletable.
    if (activeTab.locked === true) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // Locked elements can't be deleted: drop them from the delete set so
    // only the unlocked part of the selection (and arrows pinned to it)
    // goes. If the whole selection is locked, the delete is a no-op.
    const targetIds = deletableIds(ids);
    if (targetIds.size === 0) return;
    commit((els) => {
      const survivors = els.filter((el) => {
        // Belt-and-suspenders: never drop a locked element, even via the
        // arrow cascade (a locked arrow survives its endpoint going).
        if (el.locked === true) return true;
        if (targetIds.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, targetIds)) return false;
        return true;
      });
      // Arrows pinned to a group whose LAST member just went freeze to a
      // free endpoint at the pre-delete position (spec/09 group pins).
      return freezeDanglingGroupEnds(els, survivors);
    });
    setSelectedId(null);
    setEditingId(null);
    track('Element', 'Deleted');
  };

  // The deletable subset of a selection: ids whose element isn't locked.
  // Locked elements are protected from deletion (spec/09 Locking).
  const deletableIds = (ids: Set<string>): Set<string> => {
    const lockedIds = new Set(
      activeTab.elements.filter((el) => el.locked === true).map((el) => el.id),
    );
    return new Set([...ids].filter((id) => !lockedIds.has(id)));
  };

  // Marquee box-select committed by Canvas on pointer-up. Mutex with
  // single-selection: 0 → clear both; 1 → single-select that element so
  // the popover/accordion still applies; 2+ → enter true multi-select.
  const selectMarquee = (rawIds: Set<string>) => {
    // Drop any element another participant currently holds — a marquee
    // shouldn't pull a remotely-locked element into the selection.
    const ids = new Set<string>();
    for (const id of rawIds) if (!lockedByOther(id)) ids.add(id);
    if (ids.size === 0) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    } else if (ids.size === 1) {
      const only = Array.from(ids)[0]!;
      setSelectedId(only);
      setMultiSelectedIds(new Set());
    } else {
      setSelectedId(null);
      setMultiSelectedIds(ids);
    }
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // Bind every multi-selected boxed element into a single group. Same
  // groupId across all of them so move / lock / delete propagate
  // through the selection in the existing group machinery.
  const groupMultiSelected = () => {
    if (multiSelectedIds.size < 2) return;
    // Only boxed elements can carry a groupId. With fewer than two boxed
    // members (e.g. an arrow-only marquee) the commit below would change
    // nothing — yet still push an undo step, clear redo, and drop the
    // selection. Bail before any of that.
    const boxedCount = activeTab.elements.filter(
      (el) => multiSelectedIds.has(el.id) && isBoxed(el),
    ).length;
    if (boxedCount < 2) return;
    const groupId = crypto.randomUUID();
    commit((els) =>
      els.map((el) => (multiSelectedIds.has(el.id) && isBoxed(el) ? { ...el, groupId } : el)),
    );
    // After grouping, transition from marquee multi-select to single
    // selection on the new group: `selectionMembers` picks up every
    // member when one is selected, so the user sees the group treated
    // as one unit. Without this transition the multi-select toolbar
    // just stayed up looking identical and the Group click felt like
    // a no-op.
    const firstBoxed = activeTab.elements.find((el) => multiSelectedIds.has(el.id) && isBoxed(el));
    if (firstBoxed) setSelectedId(firstBoxed.id);
    setMultiSelectedIds(new Set());
    track('Element', 'Grouped');
  };

  // Toggle lock across every multi-selected element. If any member is
  // unlocked, the click locks everyone — so a partial-locked selection
  // resolves toward "all locked" with one click instead of leaving the
  // user to figure out the inverse state.
  const toggleLockMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const anyUnlocked = activeTab.elements.some(
      (el) => multiSelectedIds.has(el.id) && el.locked !== true,
    );
    commit((els) =>
      els.map((el) => (multiSelectedIds.has(el.id) ? { ...el, locked: anyUnlocked } : el)),
    );
    track('Element', anyUnlocked ? 'Locked' : 'Unlocked');
  };

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

  // Multi-select delete: removes every marquee-selected element plus any
  // arrows that reference one of them. Falls back to single-element delete
  // when there's no active multi-selection.
  const deleteMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    if (activeTab.locked === true) return;
    // Same lock rule as deleteSelected: protect locked members, delete the
    // rest. A fully-locked marquee is a no-op (selection stays put).
    const targetIds = deletableIds(multiSelectedIds);
    if (targetIds.size === 0) return;
    track('Element', 'Deleted'); // parity with single-element deleteSelected
    commit((els) => {
      const survivors = els.filter((el) => {
        if (el.locked === true) return true;
        if (targetIds.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, targetIds)) return false;
        return true;
      });
      // See deleteSelected: freeze arrows whose group just lost its last
      // member at the pre-delete position (spec/09 group pins).
      return freezeDanglingGroupEnds(els, survivors);
    });
    setMultiSelectedIds(new Set());
    setEditingId(null);
  };

  // Narrow the marquee multi-selection to just `ids` (the Filter Selection
  // menu's "keep only Arrows / Squares / Text" action). Mirrors selectMarquee's
  // mutex: dropping to a single element transitions to single-selection so the
  // popover/accordion applies; an empty set is ignored (a no-op filter).
  const narrowMultiSelection = (ids: Set<string>) => {
    if (ids.size === 0) return;
    if (ids.size === 1) {
      const only = Array.from(ids)[0]!;
      setSelectedId(only);
      setMultiSelectedIds(new Set());
    } else {
      setSelectedId(null);
      setMultiSelectedIds(ids);
    }
    setEditingId(null);
    track('Element', 'Selected', 'Filter');
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

  // Quick add (spec/09): from the selected element, add a new element to
  // `direction`. `kind` decides what's added — 'duplicate' clones the source
  // (group-aware), 'text' drops a caption to the side. Neither draws a
  // connector arrow; the + menu's Arrow action is how you connect them.
  const spawnConnectSelected = (direction: QuickConnectDirection, kind: QuickConnectKind) => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const ids = memberIdsOf(selectedId);
    const groupBounds = unionBoxedBounds(activeTab.elements, ids);
    const baseBounds = groupBounds ?? {
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
    };
    // Nearest in-line gap matching + step-until-clear placement — pure
    // geometry, lifted to lib/quick-add-placement.ts.
    const { dx, dy } = quickAddPlacement({
      elements: activeTab.elements,
      ids,
      baseBounds,
      direction,
    });
    if (kind === 'duplicate') {
      // Clone only, no connector arrow. Most duplicates don't need an arrow,
      // so adding one was usually noise to delete; draw one with the + menu's
      // Arrow action on the occasions you do want it.
      const { newElements, idMap } = duplicateGroupedElements(activeTab.elements, ids, dx, dy);
      const sourceCopyId = idMap.get(source.id);
      if (!sourceCopyId) return;
      commit((els) => [...els, ...newElements]);
      setSelectedId(sourceCopyId);
      track(
        'Element',
        'Duplicated',
        titleCaseType(source.type === 'shape' ? source.shape : source.type),
      );
      return;
    }

    // Text: drop a text element to the side and open it for editing — but
    // do NOT connect it with an arrow (a caption / label next to a node
    // isn't a flow edge, so a connector would be noise). Spawned from a
    // GROUP's plus ring, the text joins the group (spec/09): an element you
    // grow a group by belongs to it, so it moves / locks with the rest.
    if (kind === 'text') {
      const created = createText(baseBounds.x + dx, baseBounds.y + dy);
      const text = source.groupId !== undefined ? { ...created, groupId: source.groupId } : created;
      commit((els) => [...els, text]);
      setSelectedId(text.id);
      setEditingId(text.id);
      track('Element', 'Added', titleCaseType('text'));
      return;
    }
  };

  const ungroupSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source) || source.groupId === undefined) return;
    const groupId = source.groupId;
    commit((els) => ungroup(els, groupId));
    track('Element', 'Ungrouped');
  };

  return {
    deleteSelected,
    selectMarquee,
    groupMultiSelected,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    spawnConnectSelected,
    ungroupSelected,
  };
}
