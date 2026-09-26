// Structural element operations, lifted out of editor-page.tsx.
// Where useElementStyle mutates *fields* on the selection, these
// handlers change the element *set* and/or the selection itself:
// delete, marquee commit, lock, and the duplicate family
// (single, multi-select, and duplicate-and-connect).
//
// They all run through the page's history-aware `commit`, and most
// also move selection state (setSelectedId / setMultiSelectedIds), so
// the page passes those setters in. Verbatim relocation — no
// behaviour change.

import {
  arrowReferencesAny,
  createText,
  bringManyToFront,
  duplicateElements,
  sendManyToBack,
  isBoxed,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { type QuickConnectDirection, type QuickConnectKind } from '@/lib/canvas';
import { quickAddPlacement } from '@/lib/quick-add-placement';
import { useElementDuplication } from './useElementDuplication';
import { track, titleCaseType } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import { announce } from '@/lib/announcer';
import { describeMany, describeOne } from '@/lib/element-names';

type EditorSelectionActionsDeps = {
  // The active selection resolved to ids (the single selection, or the
  // marquee bag).
  currentSelectionIds: () => Set<string>;
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
  // True when another participant has the element selected (concurrent-
  // selection lock, docs/specs/007-editor/live-app.md). A marquee skips locked elements so a drag
  // box doesn't scoop up something someone else is editing.
  lockedByOther: (id: string) => boolean;
  // Elements on a LOCKED layer (docs/specs/006-diagram/layers.md): protected from deletion like
  // per-element `locked`.
  layerLockedIds: Set<string>;
  // Elements on a hidden OR locked layer (docs/specs/006-diagram/layers.md): a marquee never
  // selects them.
  layerInertIds: Set<string>;
};

export function useElementSelectionActions(deps: EditorSelectionActionsDeps) {
  const {
    currentSelectionIds,
    selectedId,
    multiSelectedIds,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    lockedByOther,
    layerLockedIds,
    layerInertIds,
  } = deps;

  // The duplicate family (single + marquee cluster with arrow
  // re-pinning) — see useElementDuplication (mounted here so the
  // caller's return shape is unchanged).
  const { duplicateSelected, duplicateMultiSelected } = useElementDuplication({
    selectedId,
    multiSelectedIds,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
  });

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
      return els.filter((el) => {
        // Belt-and-suspenders: never drop a locked element, even via the
        // arrow cascade (a locked arrow survives its endpoint going).
        // A locked LAYER protects its elements the same way (docs/specs/006-diagram/layers.md).
        if (el.locked === true || layerLockedIds.has(el.id)) return true;
        if (targetIds.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, targetIds)) return false;
        return true;
      });
    });
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

  // The deletable subset of a selection: ids whose element isn't locked.
  // Locked elements are protected from deletion (docs/specs/008-canvas/canvas-and-palette.md Locking).
  const deletableIds = (ids: Set<string>): Set<string> => {
    const lockedIds = new Set(
      activeTab.elements.filter((el) => el.locked === true).map((el) => el.id),
    );
    // Locked-layer members are protected exactly like element-locked ones.
    return new Set([...ids].filter((id) => !lockedIds.has(id) && !layerLockedIds.has(id)));
  };

  // Marquee box-select committed by Canvas on pointer-up. Mutex with
  // single-selection: 0 → clear both; 1 → single-select that element so
  // the popover/accordion still applies; 2+ → enter true multi-select.
  const selectMarquee = (rawIds: Set<string>) => {
    // Drop any element another participant currently holds — a marquee
    // shouldn't pull a remotely-locked element into the selection — and
    // anything on a hidden / locked layer (docs/specs/006-diagram/layers.md).
    const ids = new Set<string>();
    for (const id of rawIds) if (!lockedByOther(id) && !layerInertIds.has(id)) ids.add(id);
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
    announceDeleted(targetIds);
    commit((els) => {
      return els.filter((el) => {
        if (el.locked === true || layerLockedIds.has(el.id)) return true;
        if (targetIds.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, targetIds)) return false;
        return true;
      });
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

  // Quick add (docs/specs/008-canvas/canvas-and-palette.md): from the selected element, add a new element to
  // `direction`. `kind` decides what's added — 'duplicate' clones the source,
  // 'text' drops a caption to the side. Neither draws a
  // connector arrow; the + menu's Arrow action is how you connect them.
  const spawnConnectSelected = (direction: QuickConnectDirection, kind: QuickConnectKind) => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const ids = new Set([selectedId]);
    const baseBounds = { x: source.x, y: source.y, width: source.width, height: source.height };
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
      const { newElements, idMap } = duplicateElements(activeTab.elements, ids, dx, dy);
      const sourceCopyId = idMap.get(source.id);
      if (!sourceCopyId) return;
      commit((els) => [...els, ...newElements]);
      setSelectedId(sourceCopyId);
      trackDuplicated(newElements);
      return;
    }

    // Text: drop a text element to the side and open it for editing — but
    // do NOT connect it with an arrow (a caption / label next to a node
    // isn't a flow edge, so a connector would be noise).
    if (kind === 'text') {
      const text = createText(baseBounds.x + dx, baseBounds.y + dy);
      commit((els) => [...els, text]);
      setSelectedId(text.id);
      setEditingId(text.id);
      track('Element', 'Added', titleCaseType('text'));
      return;
    }
  };

  // Intra-LAYER z-order (selection popover). Distinct from the element
  // menu's Bring to Front, which is a LAYER move (docs/specs/006-diagram/layers.md): these nudge the
  // selection within its own band, so two notes on the same layer can be
  // stacked without shuffling anyone between layers. A multi-selection
  // travels together, keeping its members' relative order.
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
    selectMarquee,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    spawnConnectSelected,
  };
}
