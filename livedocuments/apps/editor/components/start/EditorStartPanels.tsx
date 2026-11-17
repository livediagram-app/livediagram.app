'use client';

import dynamic from 'next/dynamic';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { StartAgainTray } from '@/components/start/StartAgainTray';
import { ExampleContentTray } from '@/components/start/ExampleContentTray';
import { templateStartShownOf } from '@/components/start/useTemplateStartShown';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';

// The template start (docs/specs/007-editor/start-diagramming.md) carries every template's preview: loaded the first
// time an empty tab offers it, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);

// What an empty tab shows in the canvas's place: its template start. Always mounted, so the template-pick handoff
// (useTemplatePickMove) keeps watching the tab.
// It reads the tab's id, name and whether it has content, never its elements (docs/specs/007-editor/blueprints/
// flashcards.md "Performance and limits"): a typing commit renders nothing here.
export function EditorStartPanels() {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const tabId = useEditorChrome((s) => s.activeTab.id);
  const tabName = useEditorChrome((s) => s.activeTab.name);
  const tabHasContent = useEditorChrome((s) => s.activeTab.elements.length > 0);
  // An editor's empty tab: its template start (docs/specs/007-editor/start-diagramming.md). A template picked from it
  // on a document /new just made goes to its default folder (docs/specs/013-workspace/default-folders.md "A template
  // picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({ documentId, tabId, tabHasContent });
  const templateStart = useEditorChrome(templateStartShownOf);
  return templateStart ? (
    <>
      <StartFromTemplates
        key={tabId}
        tabId={tabId}
        onTemplate={(kind) => {
          void chrome.get().chooseTemplate(kind);
          moveOnTemplatePick();
        }}
      />
      {/* Closed, it can be brought back from the palette tray (StartAgainTray). */}
      <StartAgainTray key={`tray:${tabId}`} tabId={tabId} tabName={tabName} />
    </>
  ) : (
    // A template's example content, once it has landed: Clear Example Content or Keep It.
    <ExampleContentTray />
  );
}
