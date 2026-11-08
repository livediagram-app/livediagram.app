// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate and the marquee-cluster duplicate (duplicateElements). The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  duplicateElements,
  freshCopyFields,
  isBoxed,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livehuddle/document';
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
  // a hand-rolled copy of it, so a copied portal stepped through to the original.
  const duplicateMultiSelected = () => {
    const { multiSelectedIds } = readSelection();
    if (multiSelectedIds.size === 0) return;
    const { newElements: copies } = duplicateElements(
      activeTab.elements,
      multiSelectedIds,
      PASTE_OFFSET,
      PASTE_OFFSET,
    );
    if (copies.length === 0) return;
    commit((els) => [...els, ...copies]);
    trackDuplicated(copies);
    setMultiSelectedIds(new Set(copies.map((c) => c.id)));
  };

  const duplicateSelected = () => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element, offset diagonally so it's visible next to
    // the original. A retired arrow is never copied (docs/specs/002-project-scope/blueprints/element-engine.md D21).
    if (!isBoxed(source)) return;
    const offset = PASTE_OFFSET;
    const copy: BoxedElement = {
      ...source,
      id: crypto.randomUUID(),
      x: source.x + offset,
      y: source.y + offset,
      // Whatever a copy regenerates rather than inherits.
      ...freshCopyFields(source),
    };
    commit((els) => [...els, copy]);
    trackDuplicated([copy]);
    setSelectedId(copy.id);
  };

  return { duplicateSelected, duplicateMultiSelected };
}
