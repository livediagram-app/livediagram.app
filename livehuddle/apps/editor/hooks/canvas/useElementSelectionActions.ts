// Structural element operations, lifted out of editor-page.tsx.
// Where useElementStyle mutates *fields* on the selection, these
// handlers change the element *set* and/or the selection itself:
// delete, marquee commit, and the duplicate family
// (single, multi-select, and duplicate-and-connect).
//
// They all run through the page's history-aware `commit`, and most
// also move selection state (setSelectedId / setMultiSelectedIds), so
// the page passes those setters in. Verbatim relocation — no
// behaviour change.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { haptic } from '@liveworkspace/workbench/lib/haptics';
import { bringManyToFront, sendManyToBack, type Element, type Tab } from '@livehuddle/document';
import { useElementDuplication } from './useElementDuplication';
import { track } from '@/lib/telemetry';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { describeMany, describeOne } from '@/lib/element-names';

type EditorSelectionActionsDeps = {
  // The active selection resolved to ids (the single selection, or the
  // marquee bag).
  currentSelectionIds: () => Set<string>;
  // The single-selected element id (null in multi-select / none).
  // Read when an action runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  // The marquee multi-selection bag.
  // The active tab — read for its element list.
  activeTab: Tab;
  // History-aware element mutator (snapshots + emits the log).
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  setFormatSourceId: (id: string | null) => void;
  // True when another participant has the element selected (concurrent-
  // selection lock, docs/specs/007-editor/editor-app.md). A marquee skips locked elements so a drag
  // box doesn't scoop up something someone else is editing.
  lockedByOther: (id: string) => boolean;
};

export function useElementSelectionActions(deps: EditorSelectionActionsDeps) {
  const {
    currentSelectionIds,
    readSelection,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    lockedByOther,
  } = deps;

  // The duplicate family (single + marquee cluster with arrow
  // re-pinning) — see useElementDuplication (mounted here so the
  // caller's return shape is unchanged).
  const { duplicateSelected, duplicateMultiSelected } = useElementDuplication({
    readSelection,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
  });

  const deleteSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    removeSelected(ids);
  };

  // One element by id, whatever is selected: a retired element's placeholder Delete
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it"). The same removal as the Delete key.
  const deleteElementById = (id: string) => removeSelected(new Set([id]));

  const removeSelected = (targetIds: Set<string>) => {
    haptic('delete');
    // Only what was picked goes: an arrow pinned to it stays, its loose end drawn at its other end
    // (retiredArrowEnds; docs/specs/002-project-scope/blueprints/element-engine.md D22, D23).
    commit((els) => els.filter((el) => !targetIds.has(el.id)));
    setSelectedId(null);
    setEditingId(null);
    track('Element', 'Deleted');
    announceDeleted(targetIds);
  };

  // SR announcement for a delete (docs/specs/004-interface-design/canvas-accessibility.md), named like the change log
  // ("Deleted 'Login'", "Deleted 2 Squares & an Arrow"). Reads the
  // pre-commit elements so the deleted ones are still resolvable.
  const announceDeleted = (targetIds: Set<string>) => {
    const deleted = activeTab.elements.filter((el) => targetIds.has(el.id));
    if (deleted.length === 0) return;
    announce(`Deleted ${deleted.length === 1 ? describeOne(deleted[0]!) : describeMany(deleted)}`);
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
  };

  // Multi-select delete: removes every marquee-selected element plus any
  // arrows that reference one of them. Falls back to single-element delete
  // when there's no active multi-selection.
  const deleteMultiSelected = () => {
    const { multiSelectedIds } = readSelection();
    if (multiSelectedIds.size === 0) return;
    removeMultiSelected(new Set(multiSelectedIds));
  };

  const removeMultiSelected = (targetIds: Set<string>) => {
    track('Element', 'Deleted'); // parity with single-element deleteSelected
    announceDeleted(targetIds);
    commit((els) => els.filter((el) => !targetIds.has(el.id)));
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

  // Z-order from the selection popover (docs/specs/006-document/layers.md "Stacking"), the same
  // move as the element menu's Bring to Front / Send to Back. A multi-selection travels together,
  // keeping its members' relative order.
  const stackSelected = (direction: 'front' | 'back') => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      direction === 'front' ? bringManyToFront(els, ids) : sendManyToBack(els, ids),
    );
    track('Element', 'Changed', direction === 'front' ? 'StackFront' : 'StackBack');
  };

  return {
    stackSelectedFront: () => stackSelected('front'),
    stackSelectedBack: () => stackSelected('back'),
    deleteSelected,
    deleteElementById,
    selectMarquee,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
  };
}
