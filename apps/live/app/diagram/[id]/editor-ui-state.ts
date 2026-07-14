import { useState } from 'react';

// Ephemeral, in-the-moment editing UI for the canvas: which tab is
// active, what's selected / being edited, the format & group "source"
// elements, the marquee multi-selection bag, and the two transient
// picker flags. A self-contained slice (no diagram-data or persistence
// coupling) lifted out of useEditorState so the view-model is composed
// from domain slices rather than one flat bag of useState calls — same
// pattern as usePanelLayout / useEditorDialogs / usePresenceState.
//
// The setters are threaded into the editor's many action hooks; the
// values feed the derived selection / picker logic in useEditorState.
export function useEditorUiState(initialActiveId: string) {
  const [activeId, setActiveId] = useState<string>(() => initialActiveId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Drill-in selection (spec/09 groups): when set AND equal to selectedId,
  // the selection is just that member, NOT its whole group — clicking a
  // member of an already-selected group narrows to it so its settings can
  // change without ungrouping. Any other selection change leaves this
  // stale (≠ selectedId), which every consumer treats as "not solo", so
  // only the drill-in path ever needs to set it.
  const [soloSelectedId, setSoloSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // True when the active label edit began via type-to-edit (spec/09): the
  // editor places the caret at the END instead of select-all, so the
  // seeded first character isn't replaced by the next keystroke.
  const [editCursorAtEnd, setEditCursorAtEnd] = useState(false);
  const [formatSourceId, setFormatSourceId] = useState<string | null>(null);
  const [groupSourceId, setGroupSourceId] = useState<string | null>(null);
  // Multi-selection bag for marquee box-select. Mutually exclusive with the
  // single `selectedId` above: when `multiSelectedIds.size > 0`, single
  // selection / its popover / its accordion controls are suppressed. Both
  // are cleared together by `onDeselect` and by clicking any single element.
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  // Template picker mode. Welcome / "New Diagram" lives on /live/new
  // (spec/14); the 'welcome' value here is only a benign reset target.
  // 'templates' opens the per-tab Quick Start grid; 'identity' is the
  // visitor join flow.
  const [templatePickerMode, setTemplatePickerMode] = useState<
    'welcome' | 'templates' | 'identity'
  >('welcome');
  // Which line-chart's data modal is open (spec/53), or null. The context menu's
  // Data category opens it (the 2-D grid is too wide for the menu).
  const [lineDataOpenForId, setLineDataOpenForId] = useState<string | null>(null);
  // Which code block's edit dialog is open (spec/82), or null. Opened by
  // double-click on the card and by the context menu's Code category (a
  // multi-line editor is too big for the menu, like the line chart's grid).
  const [codeEditOpenForId, setCodeEditOpenForId] = useState<string | null>(null);

  return {
    activeId,
    setActiveId,
    selectedId,
    setSelectedId,
    soloSelectedId,
    setSoloSelectedId,
    editingId,
    setEditingId,
    editCursorAtEnd,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    groupSourceId,
    setGroupSourceId,
    multiSelectedIds,
    setMultiSelectedIds,
    templatePickerMode,
    setTemplatePickerMode,
    lineDataOpenForId,
    setLineDataOpenForId,
    codeEditOpenForId,
    setCodeEditOpenForId,
  };
}
