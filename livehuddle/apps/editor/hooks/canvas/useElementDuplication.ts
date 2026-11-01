// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate and the marquee-cluster duplicate (duplicateElements). The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  duplicateElements,
  freshCopyFields,
  isBoxed,
  isEventStormingNote,
  isEventStormingTab,
  landArrivals,
  withAttached,
  type ElementId,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
  detachChip,
} from '@livediagram/document';
import { trackDuplicated } from '@/lib/element-telemetry';
import { PASTE_OFFSET } from '@/lib/paste-placement';

// The copy's offset from its original. On an event-storming board a copy
// holding a workshop note STAGGERS along its lane: 24px right, no lower, and
// then lands on lanes (docs/specs/021-event-storming/event-storming.md "Always on a lane"). Everywhere else it is
// the diagonal 24px it always was.
function duplicateOffset(
  tab: Tab,
  ids: ReadonlySet<ElementId>,
): { dx: number; dy: number; lanes: boolean } {
  const lanes =
    isEventStormingTab(tab) && tab.elements.some((el) => ids.has(el.id) && isEventStormingNote(el));
  return { dx: PASTE_OFFSET, dy: lanes ? 0 : PASTE_OFFSET, lanes };
}

const landCopies = (els: Element[], copies: Element[], lanes: boolean): Element[] =>
  lanes
    ? landArrivals([...els, ...copies], new Set(copies.map((c) => c.id)), { x: 'keep' })
    : [...els, ...copies];

export function useElementDuplication(deps: {
  // Read when a duplicate runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  activeTab: Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
}) {
  const { readSelection, activeTab, commit, setSelectedId, setMultiSelectedIds } = deps;

  // Multi-select duplicate (Cmd+D on a marquee, the command palette): the same
  // duplicateElements paste and quick-add use, offset diagonally. It used to be
  // a hand-rolled copy of it that remapped arrow pins and nothing else, so a
  // duplicated mind-map subtree re-parented itself onto the ORIGINAL tree,
  // copied portals stepped through to the originals, an arrow hung off a
  // copied arrow stayed on the original line, and a connector between two
  // copied boxes was left behind unless it was in the marquee too.
  const duplicateMultiSelected = () => {
    const { multiSelectedIds } = readSelection();
    if (multiSelectedIds.size === 0) return;
    const { dx, dy, lanes } = duplicateOffset(activeTab, multiSelectedIds);
    // A host's copy takes its badges and step numbers (docs/specs/009-elements/badge.md).
    const ids = withAttached(activeTab.elements, multiSelectedIds);
    const { newElements: copies } = duplicateElements(activeTab.elements, ids, dx, dy);
    if (copies.length === 0) return;
    commit((els) => landCopies(els, copies, lanes));
    trackDuplicated(copies);
    setMultiSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const duplicateSelected = () => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = PASTE_OFFSET;
    // A host copies with its badges and step numbers (docs/specs/009-elements/badge.md).
    const withCharts = withAttached(activeTab.elements, new Set([source.id]));
    if (withCharts.size > 1) {
      const { dx, dy, lanes } = duplicateOffset(activeTab, withCharts);
      const { newElements: copies, idMap } = duplicateElements(
        activeTab.elements,
        withCharts,
        dx,
        dy,
      );
      const copyId = idMap.get(source.id);
      if (!copyId) return;
      commit((els) => landCopies(els, copies, lanes));
      trackDuplicated(copies);
      setSelectedId(copyId);
      return;
    }
    if (isBoxed(source)) {
      const { dx, dy, lanes } = duplicateOffset(activeTab, new Set([source.id]));
      // A copy of a badge, step number or pointer note on its own is let go of the host (detachChip), as a copy made
      // with others is: still attached, settling would centre it straight back over the original.
      const copy: BoxedElement = detachChip({
        ...source,
        id: crypto.randomUUID(),
        x: source.x + dx,
        y: source.y + dy,
        // Whatever a copy regenerates rather than inherits (docs/specs/021-event-storming/event-storming.md tilt).
        ...freshCopyFields(source),
      });
      commit((els) => landCopies(els, [copy], lanes));
      trackDuplicated([copy]);
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
      trackDuplicated([copy]);
      setSelectedId(copy.id);
    }
  };

  return { duplicateSelected, duplicateMultiSelected };
}
