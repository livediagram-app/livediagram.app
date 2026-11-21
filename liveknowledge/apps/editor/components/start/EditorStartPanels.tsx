'use client';

import { useEffect, useEffectEvent } from 'react';
import dynamic from 'next/dynamic';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { ExampleContentTray } from '@/components/start/ExampleContentTray';
import { templateStartShownOf } from '@/components/start/useTemplateStartShown';
import {
  closeKnowledgebaseStart,
  takeStructurePick,
  useKnowledgebaseStartOffered,
  useQueuedStructurePick,
} from '@/components/start/knowledgebase-start';
import { BLANK_KNOWLEDGEBASE, DESCRIBE_TO_SET_UP } from '@/components/start/start-structure-items';
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
// untouched.
// It reads the tab's id and whether it has content, never its elements (docs/specs/007-editor/blueprints/typing.md
// "Performance and limits"): a typing commit renders nothing here.
// A structure picked: its pages made in Start Here's place. The code that writes them is loaded on the pick, never
// on the editor's first load.
async function pickStructure(
  chrome: ReturnType<typeof useEditorChromeStore>,
  documentId: string,
  replaceId: string,
  id: string,
) {
  const [{ createStructure }, { reviewPages }, { setupStructure, structureSuggestion }] =
    await Promise.all([
      import('@/components/setup/create-structure'),
      import('@/lib/knowledge-setup/setup-tree'),
      import('@liveknowledge/knowledge'),
    ]);
  const structure = setupStructure(id);
  if (!structure) return;
  const suggestion = structureSuggestion(structure);
  await createStructure({
    chrome,
    documentId,
    pages: reviewPages(suggestion.pages),
    name: suggestion.name,
    from: 'FromStructure',
    replaceId,
    cancelled: () => false,
    onProgress: () => {},
  });
}

export function EditorStartPanels() {
  const chrome = useEditorChromeStore();
  const documentId = () => chrome.get().documentId;
  const tabId = useEditorChrome((s) => s.activeTab.id);
  // Whether the page has writing (someone else wrote, an import landed): read once per page object.
  const written = useEditorChrome((s) => s.hydrated && !pageIsUntouched(s.activeTab));
  const mayShow = useEditorChrome(templateStartShownOf);
  const offered = useKnowledgebaseStartOffered(tabId);
  const setup = useSetupOffered();
  const editor = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  // A structure asked for by link (`/new?structure=<id>`), waiting for the start to pick it.
  const queued = useQueuedStructurePick(tabId);
  const shown = mayShow && offered;
  // Writing on the page ends the offer: the start never comes back over a page with words on it.
  useEffect(() => {
    if (offered && written) closeKnowledgebaseStart(tabId);
  }, [offered, written, tabId]);
  // Each choice closes the start; only Blank Knowledgebase keeps the ask for the caret in the Title.
  const close = (keepTitleFocus: boolean) => {
    if (keepTitleFocus) wantTitleFocus(tabId);
    else takeTitleFocus(tabId);
    closeKnowledgebaseStart(tabId);
  };
  // A structure: its whole tree, made by the path a Describe to Set Up suggestion is (create-structure.ts), in
  // Start Here's place, the knowledgebase opening on its first page.
  const chooseStructure = (id: string) => {
    close(false);
    const knowledgebase = documentId();
    if (knowledgebase) void pickStructure(chrome, knowledgebase, tabId, id);
  };
  const chooseQueued = useEffectEvent((id: string, known: boolean) => {
    takeStructurePick(tabId);
    if (known) chooseStructure(id);
  });
  // The waiting structure is chosen as a click on its card would choose it, once the start may show. One the
  // structures do not have is dropped, and the start opens as `/new`'s does.
  useEffect(() => {
    if (!(shown && queued)) return;
    let cancelled = false;
    void import('@liveknowledge/knowledge').then(({ setupStructure }) => {
      if (!cancelled) chooseQueued(queued, !!setupStructure(queued));
    });
    return () => {
      cancelled = true;
    };
  }, [shown, queued]);

  if (!shown) {
    // A template's example content, once it has landed: Clear Example Content or Keep It.
    return <ExampleContentTray />;
  }
  // The start is never drawn under a pick asked for by link.
  if (queued) return null;
  const describe =
    setup === 'set-up'
      ? () => {
          track('UI', 'Opened', 'DescribeToSetUp');
          close(false);
          openSetup('set-up');
        }
      : undefined;
  const choose = (id: string) => {
    if (id === BLANK_KNOWLEDGEBASE) {
      track('UI', 'Used', 'StartBlank');
      close(true);
      return;
    }
    if (id === DESCRIBE_TO_SET_UP) {
      describe?.();
      return;
    }
    chooseStructure(id);
  };
  return (
    <StartFromTemplates
      key={tabId}
      onChoose={choose}
      onDescribe={describe}
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
