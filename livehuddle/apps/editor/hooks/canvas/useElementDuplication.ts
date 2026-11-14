// The selection's duplicate family, lifted out of
// useElementSelectionActions into a sibling hook: the single-element
// duplicate and the marquee-cluster duplicate (duplicateElements). The host mounts this and
// folds the two handlers into its return, so callers are unchanged.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  duplicateElements,
  freshCopyFields,
  isBoxed,
  snapMovedDoors,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { groupDuplicateOffset, placeDuplicate } from '@/lib/duplicate-placement';
import { trackDuplicated } from '@/lib/element-telemetry';

export function useElementDuplication(deps: {
  // Read when a duplicate runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  activeTab: Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
}) {
  const { readSelection, activeTab, commit, setSelectedId, setMultiSelectedIds } = deps;

  // Multi-select duplicate (Cmd+D on a marquee, the command palette): the same duplicateElements paste and quick-add
  // use, moved as one group to the nearest free spot beside the selection (lib/duplicate-placement.ts). A Door or a
  // Window whose Room was not copied snaps onto the nearest wall there; one riding a copied Room is already on its wall.
  const duplicateMultiSelected = () => {
    const { multiSelectedIds } = readSelection();
    if (multiSelectedIds.size === 0) return;
    const { dx, dy } = groupDuplicateOffset(activeTab.elements, multiSelectedIds);
    const { newElements } = duplicateElements(activeTab.elements, multiSelectedIds, dx, dy);
    const merged = [...activeTab.elements, ...newElements];
    const copies = snapMovedDoors(merged, new Set(newElements.map((c) => c.id))).slice(
      activeTab.elements.length,
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
    // Element-only duplicate: clones just this element into the nearest free spot beside the original, so the copy is
    // plainly there (lib/duplicate-placement.ts). A retired arrow is never copied (docs/specs/002-project-scope/
    // blueprints/element-engine.md D21).
    if (!isBoxed(source)) return;
    const copy: BoxedElement = placeDuplicate(
      source,
      {
        ...source,
        id: crypto.randomUUID(),
        // Whatever a copy regenerates rather than inherits.
        ...freshCopyFields(source),
      },
      activeTab.elements,
    );
    commit((els) => [...els, copy]);
    trackDuplicated([copy]);
    setSelectedId(copy.id);
  };

  return { duplicateSelected, duplicateMultiSelected };
}
