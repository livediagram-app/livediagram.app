'use client';

// Where the knowledgebase's views meet the editor (docs/specs/030-knowledgebase/search-and-ask.md "The three
// views"): the switch in the top row's card, a phone's switch row, and the view drawn over the editor when the
// address names Ask or AI Knowledge. Each view's code is fetched when it is first shown, never with the editor.
import dynamic from 'next/dynamic';
import { useKnowledgeView } from '@/lib/knowledge-ask/useKnowledgeView';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import {
  KNOWLEDGE_VIEW_ANCHOR,
  KNOWLEDGE_VIEW_KEEP,
  KnowledgeViewFrame,
} from './KnowledgeViewFrame';
import { AiSettingsHost } from './AiSettingsDialog';
import { KnowledgeViewSwitch } from './KnowledgeViewSwitch';
import { useKnowledgeViewsOffered } from './useKnowledgeViewsOffered';

const AskView = dynamic(() => import('./AskView').then((m) => m.AskView), { ssr: false });
const AiKnowledgeView = dynamic(
  () => import('@/components/ai-knowledge/AiKnowledgeView').then((m) => m.AiKnowledgeView),
  { ssr: false },
);

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

/** Ask or AI Knowledge over the editor; nothing while Pages shows. */
export function KnowledgeViewHost() {
  const view = useKnowledgeView();
  const offered = useKnowledgeViewsOffered();
  if (!offered || view === 'pages') return null;
  return (
    <>
      <KnowledgeViewFrame key={view} label={view === 'ask' ? 'Ask' : 'AI Knowledge'}>
        <AreaErrorBoundary area="KnowledgeView" fallback="panel" fallbackClassName="flex-1">
          {view === 'ask' ? <AskView /> : <AiKnowledgeView />}
        </AreaErrorBoundary>
      </KnowledgeViewFrame>
      {/* The knowledgebase's key and model, opened from either view. */}
      <AiSettingsHost />
    </>
  );
}
