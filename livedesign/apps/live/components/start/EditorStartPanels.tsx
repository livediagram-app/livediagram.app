'use client';

import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { closeStartForBlank } from '@/components/start/close-start-for-blank';
import { StartAgainTray } from '@liveworkspace/workbench/components/start/StartAgainTray';
import { startClosedKey } from '@/components/start/start-closed-key';
import { ExampleContentTray } from '@/components/start/ExampleContentTray';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import { useEmptyCardShown, useTemplateStartShown } from '@/components/start/useTemplateStartShown';

// The empty-canvas card a Participant or Viewer sees on an empty tab (liveworkspace/docs/specs/011-workbench/
// first-edit.md): loaded only when one is shown, never on an Editor's first load.
const EmptyCanvasBanner = dynamic(
  () => import('@/components/canvas/EmptyCanvasBanner').then((m) => m.EmptyCanvasBanner),
  { ssr: false },
);

// The template start (docs/specs/007-editor/start-diagramming.md) carries every template's preview: loaded the first
// time an empty tab offers it, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);

// What an empty tab shows in the canvas's place: its template start. Always mounted, so the template-pick note
// (useTemplatePickMove) keeps watching the tab.
export function EditorStartPanels() {
  const ctx = useEditorContext();
  const { activeTab } = ctx;
  // An editor's empty tab: its template start (docs/specs/007-editor/start-diagramming.md). A template picked from it
  // on a design /new just made goes to its default folder (docs/specs/013-workspace/default-folders.md "A template
  // picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    designId: ctx.designId,
    tabId: activeTab.id,
    tabHasContent: activeTab.elements.length > 0,
  });
  const templateStart = useTemplateStartShown();
  // A Participant's or Viewer's empty tab: the empty-canvas card (new-design-route.md "The empty-canvas hint").
  const emptyCard = useEmptyCardShown();
  return templateStart ? (
    <>
      <StartFromTemplates
        key={`${activeTab.id}:${templateStart}`}
        mode={templateStart}
        tabId={activeTab.id}
        onTemplate={(kind) => {
          // A blank closes the start as the × does: Blank Tab lands nothing, so the tab would still read as
          // empty and the start would stay over it (start-diagramming.md "The first page").
          closeStartForBlank(activeTab.id, kind);
          void ctx.chooseTemplate(kind);
          moveOnTemplatePick(kind);
        }}
      />
      {/* Closed, it can be brought back from the palette tray (StartAgainTray). */}
      <StartAgainTray
        key={`tray:${activeTab.id}:${templateStart}`}
        closedKey={startClosedKey(activeTab.id, templateStart)}
        tabName={activeTab.name}
      />
    </>
  ) : (
    <>
      {emptyCard ? (
        <EmptyCanvasBanner
          key={activeTab.id}
          tabId={activeTab.id}
          tabName={activeTab.name}
          participant={ctx.can.level === 'participate'}
        />
      ) : null}
      {/* A template's example content, once it has landed: Clear Example Content or Keep It. */}
      <ExampleContentTray />
    </>
  );
}
