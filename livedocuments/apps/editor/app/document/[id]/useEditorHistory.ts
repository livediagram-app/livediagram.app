import type { Element, Tab } from '@livedocuments/document';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { track } from '@/lib/telemetry';

type SetState<T> = (value: T) => void;

// Undo / redo handlers plus the active-tab `tick`, lifted out of
// editor-page.tsx. Undo and redo are pure snapshot moves on the
// document history (useDocumentHistory); each also clears the editing,
// selection and format-painter state so nothing points at an element
// the step just took away.
export function useEditorHistory(opts: {
  activeId: string;
  editsBlocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // A locked active tab pauses undo and redo on every route (toolbar, keyboard, command palette), so an
  // undo can't unlock the tab or roll it back past the lock (docs/specs/008-canvas/canvas-and-palette.md
  // "A locked tab pauses undo and redo").
  tabLocked: boolean;
  tickTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  undoHistory: () => void;
  redoHistory: () => void;
  set: {
    setSelectedId: SetState<string | null>;
    setEditingId: SetState<string | null>;
    setFormatSourceId: SetState<string | null>;
  };
}) {
  const { activeId, editsBlocked, tabLocked, tickTabs, undoHistory, redoHistory, set } = opts;
  const canUndo = opts.canUndo && !tabLocked;
  const canRedo = opts.canRedo && !tabLocked;
  const { setSelectedId, setEditingId, setFormatSourceId } = set;

  const tick = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    tickTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  const clearFocus = () => {
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
  };

  const undo = () => {
    if (!canUndo) return;
    track('Document', 'Undone');
    announce('Undid the last change');
    undoHistory();
    clearFocus();
  };

  const redo = () => {
    if (!canRedo) return;
    track('Document', 'Redone');
    announce('Redid the last change');
    redoHistory();
    clearFocus();
  };

  return { tick, undo, redo, canUndo, canRedo };
}
