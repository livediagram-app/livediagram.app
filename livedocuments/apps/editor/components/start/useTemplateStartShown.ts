'use client';

// Whether the active tab shows its template start (showsTemplateStart), read from the editor in render. The canvas
// reads it too, so an empty tab's first page is never drawn while the panel's own code is still loading
// (docs/specs/007-editor/start-diagramming.md "Start Making Pages").
import { pagesOf } from '@livedocuments/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { showsTemplateStart } from '@/components/start/template-start-mode';

export function useTemplateStartShown(): boolean {
  const { hydrated, zenMode, embedMode, pendingDraw, activeTab, isReadOnly } = useEditorContext();
  return showsTemplateStart({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    drawToolArmed: !!pendingDraw,
    elementCount: activeTab.elements.length,
    // Read only for an empty tab: the editor renders often, and a tab with content shows no start.
    pages: activeTab.elements.length === 0 ? pagesOf(activeTab) : [],
  });
}
