'use client';

// Which template start the active tab shows (templateStartMode), read from the editor in render. The canvas reads it
// too, so an empty tab's first page is never drawn while the panel's own code is still loading
// (docs/specs/007-editor/start-diagramming.md "The first page").
import { pagesOf, type EditorMode } from '@livedesign/design';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { templateStartMode } from '@/components/start/template-start-mode';
import { startClosedKey } from '@/components/start/start-closed-key';

export function useTemplateStartShown(): EditorMode | null {
  return useStartModeFor(false);
}

// Whether a Participant's or Viewer's empty tab shows the empty-canvas card (new-design-route.md "The empty-canvas
// hint"): the tab is as empty as an Editor's start asks for, and the person cannot edit it.
export function useEmptyCardShown(): boolean {
  const { isReadOnly } = useEditorContext();
  const asEditor = useStartModeFor(true);
  return isReadOnly && asEditor !== null;
}

// The start's mode for the tab, read as an Editor would (`asEditor`) or as this person is.
function useStartModeFor(asEditor: boolean): EditorMode | null {
  const {
    hydrated,
    zenMode,
    embedMode,
    pendingDraw,
    activeTab,
    isReadOnly,
    activeTabConnected,
    editorMode,
  } = useEditorContext();
  return templateStartMode({
    // A connected tab is empty but shows its own page, never a start (connected-tabs.md "How it looks").
    hydrated: hydrated && !activeTabConnected,
    zen: zenMode,
    embed: embedMode,
    readOnly: asEditor ? false : isReadOnly,
    drawToolArmed: !!pendingDraw,
    mode: editorMode.mode,
    elementCount: activeTab.elements.length,
    // Read only for an empty tab: the editor renders often, and a tab with content shows no start.
    pages: activeTab.elements.length === 0 ? pagesOf(activeTab) : [],
  });
}

// Whether the start is up over the tab: shown, and not closed for it. The ×, or an explicit blank (closeStartForBlank),
// closes it for the tab and mode (start-diagramming.md "Bringing it back"), and the first page is drawn at once to ask
// What Is This Page For?, so the canvas holds the first page back only while this is true.
export function useTemplateStartOpen(): boolean {
  const shown = useTemplateStartShown();
  const { activeTab, editorMode } = useEditorContext();
  const closed = useEmptyCardDismissed(startClosedKey(activeTab.id, shown ?? editorMode.mode));
  return shown !== null && !closed;
}
