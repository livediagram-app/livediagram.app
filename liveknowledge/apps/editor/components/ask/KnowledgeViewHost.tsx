'use client';

// Where the knowledgebase's views meet the editor (docs/specs/030-knowledgebase/search-and-ask.md "The three
// views"): the switch in the top row's card, a phone's switch row, and the view drawn over the editor when the
// address names Ask or AI Knowledge. Each view's code is fetched when it is first shown, never with the editor.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { takeArrival } from '@/lib/knowledge-home/arrival-handoff';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import { useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { useKnowledgeView } from '@/lib/knowledge-ask/useKnowledgeView';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import {
  KNOWLEDGE_VIEW_ANCHOR,
  KNOWLEDGE_VIEW_KEEP,
  KnowledgeViewFrame,
} from './KnowledgeViewFrame';
import { KnowledgeViewSwitch } from './KnowledgeViewSwitch';
import { useKnowledgeViewsOffered } from './useKnowledgeViewsOffered';

const AskView = dynamic(() => import('./AskView').then((m) => m.AskView), { ssr: false });
const AiKnowledgeView = dynamic(
  () => import('@/components/ai-knowledge/AiKnowledgeView').then((m) => m.AiKnowledgeView),
  { ssr: false },
);

// The knowledgebase's key and model (AiSettingsDialog.tsx): its code is fetched the first time it is opened.
const AiSettingsDialogHost = dynamic(
  () => import('./AiSettingsDialog').then((m) => m.AiSettingsHost),
  { ssr: false },
);
function AiSettingsWhenOpen() {
  return useAiSettingsOpen() ? <AiSettingsDialogHost /> : null;
}

/** The switch, for the top row's card. Hidden on a phone, which has a row of its own. */
export function KnowledgeCornerSwitch() {
  return useKnowledgeViewsOffered() ? <KnowledgeViewSwitch placement="corner" /> : null;
}

/** A phone's switch row, in the flow above the top row, and the mark the views start under. */
export function KnowledgeSwitchRow() {
  const offered = useKnowledgeViewsOffered();
  return (
    <>
      {offered ? (
        <div
          {...{ [KNOWLEDGE_VIEW_KEEP]: '' }}
          className="hidden border-b border-slate-200 bg-white px-1.5 py-1 phone:block dark:border-slate-800 dark:bg-slate-900"
        >
          <KnowledgeViewSwitch placement="row" />
        </div>
      ) : null}
      <div {...{ [KNOWLEDGE_VIEW_ANCHOR]: '' }} className="h-0" />
    </>
  );
}

// Import, asked for on the Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md "Start a Page
// From"): opened once this knowledgebase is here, for someone who may import into it.
function useImportArrival(offered: boolean): void {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const canImport = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  useEffect(() => {
    if (!offered || !documentId || !canImport) return;
    if (takeArrival('import', documentId)) chrome.get().setImportOpen(true);
  }, [offered, documentId, canImport, chrome]);
}

// A search result's passage, pressed on the Knowledgebase Home (knowledgebase-home.md "The field"): once this
// knowledgebase is here its page opens at the passage's first block, brought into view and lit, as a result in the
// knowledgebase's own search dialog does (goToBlock, which waits for the page's writing to draw).
function usePassageArrival(): void {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const hydrated = useEditorChrome((s) => s.hydrated);
  useEffect(() => {
    if (!documentId || !hydrated) return;
    const passage = takeArrival('passage', documentId);
    if (passage && chrome.get().tabs.some((t) => t.id === passage.tab))
      goToBlock(() => chrome.get(), passage.tab, passage.block);
  }, [documentId, hydrated, chrome]);
}

/** Ask or AI Knowledge over the editor; nothing while Pages shows. */
export function KnowledgeViewHost() {
  const view = useKnowledgeView();
  const offered = useKnowledgeViewsOffered();
  useImportArrival(offered);
  usePassageArrival();
  if (!offered || view === 'pages') return null;
  return (
    <>
      <KnowledgeViewFrame key={view} label={view === 'ask' ? 'Ask' : 'AI Knowledge'}>
        <AreaErrorBoundary area="KnowledgeView" fallback="panel" fallbackClassName="flex-1">
          {view === 'ask' ? <AskView /> : <AiKnowledgeView />}
        </AreaErrorBoundary>
      </KnowledgeViewFrame>
      {/* The knowledgebase's key and model, opened from either view. */}
      <AiSettingsWhenOpen />
    </>
  );
}
