import type { Dispatch, SetStateAction } from 'react';
import {
  hasRichFormatting,
  isBoxed,
  isSelfDrawingShape,
  normalizeRuns,
  type Element,
  type TableElement,
  type Tab,
  type TextRun,
} from '@livediagram/diagram';
import { patchTab } from './editor-page-helpers';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Selection-editing handlers, lifted out of editor-page.tsx: enter
// format-painter / group modes, begin / commit / cancel inline label
// edits (incl. the first-label -> diagram/tab auto-rename), type-to-edit,
// single-select (with format-paint / group-target interception), and
// shift-click multi-select toggling. applyFormatFromSource comes from
// useElementHelpers and is passed in.
export function useSelectionEditing(opts: {
  selectedId: string | null;
  isReadOnly: boolean;
  formatSourceId: string | null;
  groupSourceId: string | null;
  multiSelectedIds: Set<string>;
  diagramName: string;
  tabs: Tab[];
  activeTab: Tab;
  commit: (updater: (els: Element[]) => Element[]) => void;
  // Non-history tab mutator: the first-label tab auto-rename rides the
  // label commit as a side effect, not as its own undo step — a second
  // history frame made Cmd+Z look like a no-op (it undid only the
  // invisible rename) and needed two undos for one action.
  tickTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  applyFormatFromSource: (targetId: string) => void;
  // True when ANOTHER participant currently has this element selected
  // (concurrent-selection lock, spec/07). Blocks select / edit so two
  // people don't fight over the same element. Advisory + presence-only.
  lockedByOther: (id: string) => boolean;
  set: {
    setFormatSourceId: SetState<string | null>;
    setGroupSourceId: SetState<string | null>;
    setSelectedId: SetState<string | null>;
    // Cleared on plain selects: drill-in solo (spec/09 groups) is only
    // entered by clicking a member of an already-selected group on the
    // canvas (useBoxedDragHandlers.beginDrag).
    setSoloSelectedId: SetState<string | null>;
    setEditingId: SetState<string | null>;
    // Type-to-edit (spec/09) seeds the label with the first typed char,
    // so the editor must place the caret at the END rather than
    // select-all (which would let the next keystroke replace the seed —
    // the "first character gets replaced" bug). beginEdit (double-click /
    // Space) sets this false to keep select-all-then-retype.
    setEditCursorAtEnd: SetState<boolean>;
    setMultiSelectedIds: SetState<Set<string>>;
    setDiagramName: SetState<string>;
    // Retarget an open element context menu when the selection moves to a
    // different element, so the menu reflects the newly-selected element's
    // state (animation / speed / colours) instead of the previous one — the
    // menu lingers across a plain click because element pointerdown stops
    // propagation, so without this it would show stale values.
    setContextMenu: SetState<EditorContextMenuState | null>;
  };
}) {
  const {
    selectedId,
    isReadOnly,
    formatSourceId,
    groupSourceId,
    multiSelectedIds,
    diagramName,
    tabs,
    activeTab,
    commit,
    tickTabs,
    applyFormatFromSource,
    lockedByOther,
    set,
  } = opts;
  const {
    setFormatSourceId,
    setGroupSourceId,
    setSelectedId,
    setSoloSelectedId,
    setEditingId,
    setEditCursorAtEnd,
    setMultiSelectedIds,
    setDiagramName,
    setContextMenu,
  } = set;

  const beginFormatPainter = () => {
    if (!selectedId) return;
    setFormatSourceId(selectedId);
    setGroupSourceId(null);
  };

  const beginGroup = () => {
    if (!selectedId) return;
    setGroupSourceId(selectedId);
    setFormatSourceId(null);
  };

  const beginEdit = (elementId: string) => {
    // Viewers may select to inspect, but never enter text-edit mode.
    if (isReadOnly) return;
    // Another participant has it selected — don't let two people edit it.
    if (lockedByOther(elementId)) return;
    if (formatSourceId !== null) return;
    // The self-drawing data components (progress / rail / rating / charts)
    // have no editable text label, so no entry point (double-click, Space,
    // type-to-edit) opens the inline editor for them.
    const el = activeTab.elements.find((e) => e.id === elementId);
    if (el && el.type === 'shape' && isSelfDrawingShape(el.shape)) return;
    setGroupSourceId(null);
    setSelectedId(elementId);
    // Double-click / Space edit: select-all so a retype replaces the label.
    setEditCursorAtEnd(false);
    setEditingId(elementId);
  };

  // Single entry point for every table mutation: a partial patch of the
  // table's fields, applied in ONE commit. Structural ops (insert / delete
  // / move row-column, clear cell) change `cells` AND the parallel
  // `colWidths` / `rowHeights` / `cellStyles` arrays at once; issuing those
  // as separate commits each read the same stale `activeTab.elements` base
  // and clobbered one another (only the last landed), losing the reorder
  // and dropping pinned widths / styles. One patch, one commit, no drift.
  const commitTable = (
    elementId: string,
    patch: Partial<Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'>>,
  ) => {
    commit((els) =>
      els.map((el) => (el.id === elementId && el.type === 'table' ? { ...el, ...patch } : el)),
    );
  };

  const commitLabel = (elementId: string, label: string, runs?: TextRun[]) => {
    // Per-range formatting (spec/09): keep `richText` only when it carries
    // real overrides, otherwise strip it so a plain label round-trips as
    // plain JSON. `label` stays the plain-text mirror either way.
    const richText = runs ? normalizeRuns(runs) : undefined;
    const keepRich = hasRichFormatting(richText);
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId) return el;
        // Boxed elements always carry a label; arrows treat an empty
        // string as "no label" and drop the field so the data model
        // round-trips cleanly through API JSON.
        if (isBoxed(el)) {
          const { richText: _prev, ...base } = el as typeof el & { richText?: TextRun[] };
          void _prev;
          return keepRich ? { ...base, label, richText } : { ...base, label };
        }
        if (el.type === 'arrow') {
          if (label.length === 0) {
            const { label: _drop, ...rest } = el;
            void _drop;
            return rest;
          }
          return { ...el, label };
        }
        return el;
      }),
    );
    setEditingId(null);
    // While the diagram is still on its default name, mirror the label of
    // the very first element of the very first tab into the diagram title:
    // typing on the welcome rectangle is a strong signal of intent. Once
    // the user has explicitly named the diagram (or named it via another
    // path), we stop tracking.
    const trimmed = label.trim();
    if (diagramName === 'Untitled diagram') {
      const firstTab = tabs[0];
      const firstEl = firstTab?.elements[0];
      if (firstEl && firstEl.id === elementId) {
        if (trimmed && trimmed !== 'Blank Diagram') {
          setDiagramName(trimmed);
        }
      }
    }
    // Parallel auto-rename for the active tab while its name still matches
    // the default `Tab N` pattern: the first element's label becomes the
    // tab name. Fires at most once per tab (any non-default name stops the
    // gate, including the auto-renamed value itself). See spec/05.
    if (trimmed && /^Tab \d+$/.test(activeTab.name)) {
      const firstEl = activeTab.elements[0];
      if (firstEl && firstEl.id === elementId) {
        tickTabs((ts) => patchTab(ts, activeTab.id, { name: trimmed }));
      }
    }
  };

  const cancelEdit = () => setEditingId(null);

  const typeIntoSelected = (elementId: string, char: string): boolean => {
    if (isReadOnly) return false;
    if (lockedByOther(elementId)) return false;
    const el = activeTab.elements.find((e) => e.id === elementId);
    if (!el) return false;
    const labelable = isBoxed(el) || el.type === 'arrow';
    if (!labelable) return false;
    // Self-drawing data components have no editable label (see beginEdit).
    if (el.type === 'shape' && isSelfDrawingShape(el.shape)) return false;
    // Type-to-edit REPLACES the whole label with the typed char, so any
    // per-range `richText` from a prior edit must be dropped — otherwise the
    // editor would re-open against the stale runs instead of the seed char.
    commit((els) =>
      els.map((e) => {
        if (e.id !== elementId) return e;
        const { richText: _drop, ...base } = e as typeof e & { richText?: unknown };
        return { ...base, label: char };
      }),
    );
    setSelectedId(elementId);
    // Seeded with the first char → caret at end, NOT select-all, so the
    // next keystroke appends instead of replacing it.
    setEditCursorAtEnd(true);
    setEditingId(elementId);
    return true;
  };

  // --- Selection + drag dispatch ------------------------------------------

  const selectElement = (id: string) => {
    // Concurrent-selection lock (spec/07): another participant has this
    // element selected, so block it — for plain select AND for format-
    // paint / group targets, since both would mutate an element someone
    // else is working on. The not-allowed cursor + "Locked to <name>"
    // tooltip on the element communicate why.
    if (lockedByOther(id)) return;
    if (formatSourceId !== null) {
      // Format-paint mode: apply the source's formatting to the
      // clicked target instead of selecting it. applyFormatFromSource
      // clears formatSourceId itself; it handles boxed→boxed and
      // arrow→arrow, no-ops cross-kind.
      applyFormatFromSource(id);
      return;
    }
    if (groupSourceId !== null) {
      setGroupSourceId(null);
      return;
    }
    setSoloSelectedId(null);
    setSelectedId(id);
    // Clicking a single element always collapses any active multi-selection
    // down to that one element — the user's intent is unambiguous.
    setMultiSelectedIds(new Set());
    // If an element context menu is open, retarget it to the newly-selected
    // element so its categories (notably Animation + speed) reflect the new
    // element rather than the previously-clicked one. The menu only lingers in
    // 'element' mode; a 'multi' menu is left to its own dismissal.
    setContextMenu((cur) => (cur && cur.mode === 'element' ? { ...cur, elementId: id } : cur));
  };

  // Shift-click membership toggle. Folds a current single-selection
  // into the multi-set so users can promote "I already had A
  // selected, now also B and C" without first dropping to nothing.
  // Toggling the last member out of the multi-set drops back to
  // empty selection.
  const toggleInMultiSelect = (id: string) => {
    // Don't let a shift-click pull a remotely-held element into the set.
    if (lockedByOther(id)) return;
    const next = new Set(multiSelectedIds);
    if (selectedId && !next.has(selectedId)) next.add(selectedId);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedId(null);
    setMultiSelectedIds(next);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  return {
    beginFormatPainter,
    beginGroup,
    beginEdit,
    commitLabel,
    commitTable,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  };
}
