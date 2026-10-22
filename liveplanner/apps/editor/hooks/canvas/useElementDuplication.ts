// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate and the marquee-cluster duplicate (duplicateElements). The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import type { Selection } from '@/lib/selection-store';
import {
  duplicateElements,
  freshCopyFields,
  isBoxed,
  sheetDrawnChartIds,
  withSheetCharts,
  withAttached,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
  detachChip,
} from '@liveplanner/project';
import { trackDuplicated } from '@/lib/element-telemetry';
import { PASTE_OFFSET } from '@/lib/paste-placement';

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
    const [dx, dy] = [PASTE_OFFSET, PASTE_OFFSET];
    // A Sheet's copy takes the charts it draws (docs/specs/029-sheets/sheet.md "Charts"), which are never selected.
    // ...and a host's copy takes its badges and step numbers (docs/specs/009-elements/badge.md).
    const ids = withAttached(
      activeTab.elements,
      withSheetCharts(activeTab.elements, multiSelectedIds),
    );
    const { newElements: copies } = duplicateElements(activeTab.elements, ids, dx, dy);
    if (copies.length === 0) return;
    commit((els) => [...els, ...copies]);
    trackDuplicated(copies);
    const drawn = sheetDrawnChartIds(copies);
    setMultiSelectedIds(new Set(copies.filter((c) => !drawn.has(c.id)).map((c) => c.id)));
  };

  const duplicateSelected = () => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = PASTE_OFFSET;
    // A Sheet drawing charts copies with them, through duplicateElements, so they read the Sheet's copy.
    // ...and its badges and step numbers (docs/specs/009-elements/badge.md).
    const withCharts = withAttached(
      activeTab.elements,
      withSheetCharts(activeTab.elements, new Set([source.id])),
    );
    if (withCharts.size > 1) {
      const [dx, dy] = [PASTE_OFFSET, PASTE_OFFSET];
      const { newElements: copies, idMap } = duplicateElements(
        activeTab.elements,
        withCharts,
        dx,
        dy,
      );
      const copyId = idMap.get(source.id);
      if (!copyId) return;
      commit((els) => [...els, ...copies]);
      trackDuplicated(copies);
      setSelectedId(copyId);
      return;
    }
    if (isBoxed(source)) {
      const [dx, dy] = [PASTE_OFFSET, PASTE_OFFSET];
      // A copy of a badge, step number or pointer note on its own is let go of the host (detachChip), as a copy made
      // with others is: still attached, settling would centre it straight back over the original.
      const copy: BoxedElement = detachChip({
        ...source,
        id: crypto.randomUUID(),
        x: source.x + dx,
        y: source.y + dy,
        // Whatever a copy regenerates rather than inherits.
        ...freshCopyFields(source),
      });
      commit((els) => [...els, copy]);
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
