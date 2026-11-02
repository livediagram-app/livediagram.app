'use client';

import dynamic from 'next/dynamic';
import type { TemplateStartMode } from '@/components/start/start-template-items';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { showsEmptyCanvasCard } from '@/components/canvas/empty-canvas-card';
import { StartAgainTray } from '@/components/start/StartAgainTray';
import { StartViewTransition } from '@/components/start/StartViewTransition';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';

// The template starts (docs/specs/007-editor/start-diagramming.md) carry every template's preview: loaded the first time
// an empty tab offers one, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);

// What an empty tab shows in the canvas's place: an editor's template start, or the empty-canvas card. Always mounted, so the template-pick handoff
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const { hydrated, zenMode, embedMode, pendingDraw, activeTab, isReadOnly } = ctx;
  // Empty-canvas hint (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): a card in the middle of
  // the canvas while the active tab has no elements. Not dismissible: it goes once there's content. The sign-in nudge
  // sits at the bottom, clear of it, so the two show together.
  const showEmptyCanvasBanner = showsEmptyCanvasCard({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    drawToolArmed: !!pendingDraw,
    elementCount: activeTab.elements.length,
  });
  // An editor's empty tab: its template start (docs/specs/007-editor/start-diagramming.md).
  // A template picked from a start screen on a document /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    documentId: ctx.documentId,
    tabId: activeTab.id,
    tabHasContent: activeTab.elements.length > 0,
  });
  // Its template start (docs/specs/007-editor/start-diagramming.md "When it shows"): to someone who can edit, while
  // the tab is empty, outside zen and embed, with no draw tool armed.
  const templateStart: TemplateStartMode | null =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    !pendingDraw &&
    activeTab.elements.length === 0
      ? 'workshop'
      : null;
  return (
    <>
      {/* One View Transition around the start, so it turns in place. */}
      <StartViewTransition>
        {/* Empty-canvas hint (docs/specs/007-editor/new-document-route.md): a calm card in the
      middle of an empty canvas, so a blank document reads as intentionally blank. */}
        {/* An editor's empty tab offers its template start, in
      the card's place (docs/specs/007-editor/start-diagramming.md). */}
        {templateStart ? (
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
        ) : showEmptyCanvasBanner ? (
          <EmptyCanvasBanner
            key={activeTab.id}
            tabId={activeTab.id}
            tabName={activeTab.name}
            readOnly={isReadOnly}
            participant={ctx.can.addContent && isReadOnly}
          />
        ) : null}
      </StartViewTransition>
    </>
  );
}
