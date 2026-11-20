'use client';

// AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md): the knowledgebase's third view. What agents know,
// where they learned it and what they could not find, from one read of `GET knowledge` when the view opens and one
// after each action here. Everyone sees it; settling a conflict, drafting or dismissing a question, accepting or
// dismissing a suggestion and Always in Context are an Editor's.
import { useState } from 'react';
import { Button, EmptyState } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { AiSettingsButton, openAiSettingsFrom } from '@/components/ask/AiSettingsButton';
import { AiViewIcon } from '@/components/ask/ask-icons';
import { KnowledgeViewHeader } from '@/components/ask/KnowledgeViewFrame';
import { openPassage } from '@/components/ask/open-passage';
import { PagePickerDialog } from '@/components/ask/PagePickerDialog';
import { useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { useDraftPage } from '@/components/ask/useDraftPage';
import { useToast } from '@/hooks/ui/useToast';
import {
  apiDismissKnowledgeConflict,
  apiDismissKnowledgeQuestion,
  apiSetPageKnowledge,
} from '@/lib/api/knowledge';
import { agentSample } from '@/lib/knowledge-ask/overview-words';
import {
  apiAcceptKnowledgeSuggestion,
  apiDismissKnowledgeSuggestion,
  overviewFailureText,
} from '@/lib/knowledge-ask/suggestions-api';
import { knowledgeFailureText } from '@/lib/knowledge/knowledge-words';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { AgentsSection } from './AgentsSection';
import { ConflictsSection } from './ConflictsSection';
import { AgentSampleCard, ContextSection, HealthSection } from './HealthAndContext';
import { QuestionsSection } from './QuestionsSection';
import { SuggestionsSection } from './SuggestionsSection';
import { useKnowledgeOverview } from './useKnowledgeOverview';

export function AiKnowledgeView() {
  const session = useAskSession();
  if (!session) return null;
  return <AiKnowledge session={session} />;
}

function AiKnowledge({ session }: { session: AskSession }) {
  const { who, documentId, rights } = session;
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const now = useRelativeNow();
  const offline = rights.askOff === 'offline';
  const pages = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const { state, busy, failure, refresh, run } = useKnowledgeOverview(who, documentId, !offline);
  const overview = state.status === 'ready' ? state.overview : null;
  const { drafting, draft } = useDraftPage(session, overview?.hasKey ?? false);
  const [adding, setAdding] = useState(false);

  // The MCP server, the command line and tokens: Settings' own page for them.
  const connect = () => {
    track('UI', 'Opened', 'ConnectAgent');
    chrome.get().openSettingsOn('tokens');
  };
  // A page, at a passage's first block when one is named (a conflict's side): brought into view and lit, as a
  // search result's is (openPassage).
  const openPage = (tab: string, block = '') => {
    if (!openPassage(chrome, tab, block))
      toast.info('That page is no longer in this knowledgebase.');
  };
  const setContext = (tab: string, context: boolean) =>
    run(
      `context:${tab}`,
      () => apiSetPageKnowledge(who, documentId, tab, { context }),
      // Over the budget, the route's own reason from its sizes.
      (err) => knowledgeFailureText(err, 'context'),
    );
  const inContext = new Set(overview?.context.pages.map((page) => page.tab));

  return (
    <>
      <KnowledgeViewHeader
        title="AI Knowledge"
        about="What agents know of this knowledgebase, where they learned it and what they could not find."
      >
        <Button variant="secondary" size="xs" onClick={connect}>
          Connect an Agent
        </Button>
        {offline ? null : <AiSettingsButton />}
      </KnowledgeViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto" data-ai-knowledge="">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
          {offline ? (
            <EmptyState
              icon={<AiViewIcon />}
              title="No AI Knowledge in an Offline Knowledgebase"
              description="This knowledgebase is kept in this browser, where no agent can reach it and nothing is counted. Its pages and search work as they are."
            />
          ) : state.status === 'loading' ? (
            <div role="status" aria-label="Loading AI Knowledge" className="flex flex-col gap-4">
              {[0, 1, 2].map((at) => (
                <div
                  key={at}
                  className="h-40 rounded-2xl border border-slate-200 bg-white motion-safe:animate-pulse dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          ) : !overview ? (
            <Callout
              tone="error"
              size="md"
              role="alert"
              title="AI Knowledge Could Not Be Read"
              action={{ label: 'Try Again', onSelect: refresh }}
            >
              Check your connection.
            </Callout>
          ) : (
            <>
              {failure ? (
                <Callout tone="error" size="md" role="alert">
                  {failure}
                </Callout>
              ) : null}
              <AgentsSection
                agents={overview.agents}
                suggestions={overview.suggestions}
                onConnect={connect}
                onOpenPage={openPage}
              />
              <ConflictsSection
                conflicts={overview.conflicts}
                hasKey={overview.hasKey}
                canResolve={rights.resolve}
                canManageAi={rights.manageAi}
                busy={busy}
                now={now}
                onOpenPage={openPage}
                onOpenAiSettings={openAiSettingsFrom}
                onDismiss={(id) => {
                  if (!rights.resolve) return;
                  track('UI', 'Used', 'ConflictDismissed');
                  void run(
                    id,
                    () => apiDismissKnowledgeConflict(who, documentId, id),
                    (err) => overviewFailureText(err, 'dismiss-conflict'),
                  );
                }}
              />
              <QuestionsSection
                questions={overview.questions}
                canDraft={rights.makePages}
                canDismiss={rights.resolve}
                drafting={drafting}
                busy={busy}
                onDraft={(question) => void draft(question.question)}
                onDismiss={(key) => {
                  if (!rights.resolve) return;
                  track('UI', 'Used', 'QuestionDismissed');
                  void run(
                    key,
                    () => apiDismissKnowledgeQuestion(who, documentId, key),
                    (err) => overviewFailureText(err, 'dismiss-question'),
                  );
                }}
              />
              <SuggestionsSection
                suggestions={overview.suggestions}
                canResolve={rights.resolve}
                busy={busy}
                onOpenPage={openPage}
                onAccept={(suggestion) => {
                  if (!rights.resolve) return;
                  track('UI', 'Used', 'SuggestionAccepted');
                  void run(
                    `accept:${suggestion.id}`,
                    () => apiAcceptKnowledgeSuggestion(who, documentId, suggestion.id),
                    (err) => overviewFailureText(err, 'accept-suggestion'),
                  );
                }}
                onDismiss={(suggestion) => {
                  if (!rights.resolve) return;
                  track('UI', 'Used', 'SuggestionDismissed');
                  void run(
                    `dismiss:${suggestion.id}`,
                    () => apiDismissKnowledgeSuggestion(who, documentId, suggestion.id),
                    (err) => overviewFailureText(err, 'dismiss-suggestion'),
                  );
                }}
              />
              <HealthSection health={overview.health} />
              <ContextSection
                context={overview.context}
                canEdit={rights.context}
                busy={busy}
                onOpenPage={openPage}
                onAdd={() => setAdding(true)}
                onRemove={(tab) => {
                  if (!rights.context) return;
                  track('UI', 'Removed', 'ContextPage');
                  void setContext(tab, false);
                }}
              />
              <AgentSampleCard sample={agentSample(overview, now)} />
            </>
          )}
        </div>
      </div>
      {adding && rights.context ? (
        <PagePickerDialog
          title="Add a Page to Always in Context"
          about="Every agent is handed this page before it starts. A page that would pass the budget is refused."
          confirmLabel="Add to Context"
          pages={pages}
          disabledReason={(page) => (inContext.has(page.id) ? 'Already In' : undefined)}
          onClose={() => setAdding(false)}
          onPick={(tab) => {
            setAdding(false);
            track('UI', 'Added', 'ContextPage');
            void setContext(tab, true);
          }}
        />
      ) : null}
    </>
  );
}
