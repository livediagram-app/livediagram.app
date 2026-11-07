'use client';

// Whether the active tab shows its template start (showsTemplateStart), read from the editor in render. The canvas
// reads it too, so an empty tab's first page is never drawn while the panel's own code is still loading
// (docs/specs/007-editor/start-diagramming.md "Start Making Pages").
import { pagesOf } from '@livedocuments/document';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { showsTemplateStart } from '@/components/start/template-start-mode';
import { startClosedKey } from '@/components/start/start-closed-key';

export function useTemplateStartShown(): boolean {
  const { hydrated, zenMode, embedMode, pendingDraw, activeTab, isReadOnly, activeTabConnected } =
    useEditorContext();
  return showsTemplateStart({
    // A connected tab is empty but shows its own page, never a start (connected-tabs.md "How it looks").
    hydrated: hydrated && !activeTabConnected,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    drawToolArmed: !!pendingDraw,
    elementCount: activeTab.elements.length,
    // Read only for an empty tab: the editor renders often, and a tab with content shows no start.
    pages: activeTab.elements.length === 0 ? pagesOf(activeTab) : [],
  });
}

// Whether the start is up over the tab: shown, and not closed for it. An explicit blank opens with its start closed
// (closeStartForBlank), its one page drawn at once to ask What Is This Page For? (start-diagramming.md "Bringing it
// back"), so the canvas holds the first page back only while this is true.
export function useTemplateStartOpen(): boolean {
  const shown = useTemplateStartShown();
  const { activeTab } = useEditorContext();
  const closed = useEmptyCardDismissed(startClosedKey(activeTab.id));
  return shown && !closed;
}
