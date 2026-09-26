// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate and the marquee-cluster duplicate (duplicateElements). The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import {
  duplicateElements,
  freshCopyFields,
  isBoxed,
  isEventStormingNote,
  isEventStormingTab,
  landArrivals,
  type ElementId,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
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
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  activeTab: Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
}) {
  const { selectedId, multiSelectedIds, activeTab, commit, setSelectedId, setMultiSelectedIds } =
    deps;

  // Multi-select duplicate (Cmd+D on a marquee, the command palette): the same
  // duplicateElements paste and quick-add use, offset diagonally. It used to be
  // a hand-rolled copy of it that remapped arrow pins and nothing else, so a
  // duplicated mind-map subtree re-parented itself onto the ORIGINAL tree,
  // copied portals stepped through to the originals, an arrow hung off a
  // copied arrow stayed on the original line, and a connector between two
  // copied boxes was left behind unless it was in the marquee too.
  const duplicateMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const { dx, dy, lanes } = duplicateOffset(activeTab, multiSelectedIds);
    const { newElements: copies } = duplicateElements(activeTab.elements, multiSelectedIds, dx, dy);
    if (copies.length === 0) return;
    commit((els) => landCopies(els, copies, lanes));
    trackDuplicated(copies);
    setMultiSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = PASTE_OFFSET;
    if (isBoxed(source)) {
      const { dx, dy, lanes } = duplicateOffset(activeTab, new Set([source.id]));
      const copy: BoxedElement = {
        ...source,
        id: crypto.randomUUID(),
        x: source.x + dx,
        y: source.y + dy,
        // Whatever a copy regenerates rather than inherits (docs/specs/021-event-storming/event-storming.md tilt).
        ...freshCopyFields(source),
      };
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
