'use client';

import dynamic from 'next/dynamic';
import { pagesOf } from '@livedocuments/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { StartAgainTray } from '@/components/start/StartAgainTray';
import { templateStartMode } from '@/components/start/template-start-mode';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';

// The template start (docs/specs/007-editor/start-diagramming.md) carries every template's preview: loaded the first
// time an empty tab offers it, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);

// What an empty tab shows in the canvas's place: its template start. Always mounted, so the template-pick handoff
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const { hydrated, zenMode, embedMode, pendingDraw, activeTab, isReadOnly, accountUserId } = ctx;
  // An editor's empty tab: its template start (docs/specs/007-editor/start-diagramming.md). A template picked from it
  // on a document /new just made goes to its default folder (docs/specs/013-workspace/default-folders.md "A template
  // picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    ownerId: ctx.selfParticipant.id,
    documentId: ctx.documentId,
    tabId: activeTab.id,
    signedIn: !!accountUserId,
    tabHasContent: activeTab.elements.length > 0,
  });
  const templateStart = templateStartMode({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    drawToolArmed: !!pendingDraw,
    mode: ctx.editorMode.mode,
    elementCount: activeTab.elements.length,
    // Read only for an empty tab: EditorView renders often, and a tab with content shows no start.
    pages: activeTab.elements.length === 0 ? pagesOf(activeTab) : [],
  });
  return templateStart ? (
    <>
      <StartFromTemplates
        key={`${activeTab.id}:${templateStart}`}
        mode={templateStart}
        tabId={activeTab.id}
        onTemplate={(kind) => {
          void ctx.chooseTemplate(kind);
          moveOnTemplatePick(kind);
        }}
      />
      {/* Closed, it can be brought back from the palette tray (StartAgainTray). */}
      <StartAgainTray
        key={`tray:${activeTab.id}:${templateStart}`}
        mode={templateStart}
        tabId={activeTab.id}
        tabName={activeTab.name}
      />
    </>
  ) : null;
}
