'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TemplateKind } from '@liveknowledge/templates';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { ExampleContentTray } from '@/components/start/ExampleContentTray';
import { templateStartShownOf } from '@/components/start/useTemplateStartShown';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import {
  closeKnowledgebaseStart,
  useKnowledgebaseStartOffered,
} from '@/components/start/knowledgebase-start';
import { BLANK_KNOWLEDGEBASE } from '@/components/start/start-template-items';
import { useSetupOffered } from '@/components/setup/useSetupOffered';
import { openSetup } from '@/lib/knowledge-setup/setup-open';
import { pageIsUntouched } from '@/lib/knowledge-setup/setup-empty';
import { takeTitleFocus, wantTitleFocus } from '@/lib/page-title-focus';
import { track } from '@/lib/telemetry';

// The start (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen") carries every template's preview:
// loaded the first time a new knowledgebase offers it, never on the editor's first load.
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);

// What a new knowledgebase shows over its first page: its start screen, while /new's offer stands and the page is
// untouched. Always mounted, so the template-pick handoff (useTemplatePickMove) keeps watching the tab.
// It reads the tab's id and whether it has content, never its elements (docs/specs/007-editor/blueprints/typing.md
// "Performance and limits"): a typing commit renders nothing here.
export function EditorStartPanels() {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const tabId = useEditorChrome((s) => s.activeTab.id);
  const tabHasContent = useEditorChrome((s) => s.activeTab.elements.length > 0);
  // Whether the page has writing (someone else wrote, an import landed): read once per page object.
  const written = useEditorChrome((s) => s.hydrated && !pageIsUntouched(s.activeTab));
  // A template picked from it on a knowledgebase /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({ documentId, tabId, tabHasContent });
  const mayShow = useEditorChrome(templateStartShownOf);
  const offered = useKnowledgebaseStartOffered(tabId);
  const setup = useSetupOffered();
  const editor = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  // Writing on the page ends the offer: the start never comes back over a page with words on it.
  useEffect(() => {
    if (offered && written) closeKnowledgebaseStart(tabId);
  }, [offered, written, tabId]);

  if (!(mayShow && offered)) {
    // A template's example content, once it has landed: Clear Example Content or Keep It.
    return <ExampleContentTray />;
  }
  // Each choice closes the start; only Blank Knowledgebase keeps the ask for the caret in the Title.
  const close = (keepTitleFocus: boolean) => {
    if (keepTitleFocus) wantTitleFocus(tabId);
    else takeTitleFocus(tabId);
    closeKnowledgebaseStart(tabId);
  };
  const choose = (kind: TemplateKind) => {
    if (kind === BLANK_KNOWLEDGEBASE) {
      track('UI', 'Used', 'StartBlank');
      close(true);
      return;
    }
    close(false);
    void chrome.get().chooseTemplate(kind);
    moveOnTemplatePick();
  };
  return (
    <StartFromTemplates
      key={tabId}
      onTemplate={choose}
      onDescribe={
        setup === 'set-up'
          ? () => {
              track('UI', 'Opened', 'DescribeToSetUp');
              close(false);
              openSetup('set-up');
            }
          : undefined
      }
      onImport={
        editor
          ? () => {
              track('UI', 'Opened', 'KnowledgeImport');
              close(false);
              chrome.get().setImportOpen(true);
            }
          : undefined
      }
    />
  );
}
