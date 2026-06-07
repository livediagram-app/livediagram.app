import type { Dispatch, SetStateAction } from 'react';
import { isBoxed, type Element, type Tab } from '@livediagram/diagram';
import { patchTab } from './editor-page-helpers';

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
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  applyFormatFromSource: (targetId: string) => void;
  set: {
    setFormatSourceId: SetState<string | null>;
    setGroupSourceId: SetState<string | null>;
    setSelectedId: SetState<string | null>;
    setEditingId: SetState<string | null>;
    setMultiSelectedIds: SetState<Set<string>>;
    setDiagramName: SetState<string>;
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
    commitTabs,
    applyFormatFromSource,
    set,
  } = opts;
  const {
    setFormatSourceId,
    setGroupSourceId,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setDiagramName,
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
    if (formatSourceId !== null) return;
    setGroupSourceId(null);
    setSelectedId(elementId);
    setEditingId(elementId);
  };

  const commitCells = (elementId: string, cells: string[][]) => {
    commit((els) =>
      els.map((el) => (el.id === elementId && el.type === 'table' ? { ...el, cells } : el)),
    );
  };

  const commitLabel = (elementId: string, label: string) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId) return el;
        // Boxed elements always carry a label; arrows treat an empty
        // string as "no label" and drop the field so the data model
        // round-trips cleanly through API JSON.
        if (isBoxed(el)) return { ...el, label };
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
        commitTabs((ts) => patchTab(ts, activeTab.id, { name: trimmed }));
      }
    }
  };

  const cancelEdit = () => setEditingId(null);

  const typeIntoSelected = (elementId: string, char: string): boolean => {
    if (isReadOnly) return false;
    const el = activeTab.elements.find((e) => e.id === elementId);
    if (!el) return false;
    const labelable = isBoxed(el) || el.type === 'arrow';
    if (!labelable) return false;
    commit((els) => els.map((e) => (e.id === elementId ? { ...e, label: char } : e)));
    setSelectedId(elementId);
    setEditingId(elementId);
    return true;
  };

  // --- Selection + drag dispatch ------------------------------------------

  const selectElement = (id: string) => {
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
    setSelectedId(id);
    // Clicking a single element always collapses any active multi-selection
    // down to that one element — the user's intent is unambiguous.
    setMultiSelectedIds(new Set());
  };

  // Shift-click membership toggle. Folds a current single-selection
  // into the multi-set so users can promote "I already had A
  // selected, now also B and C" without first dropping to nothing.
  // Toggling the last member out of the multi-set drops back to
  // empty selection.
  const toggleInMultiSelect = (id: string) => {
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
    commitCells,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  };
}
