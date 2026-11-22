'use client';

// AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md): the knowledgebase's third view, a dashboard
// (AiDashboard). What agents know, where they learned it and what they could not find, from one read of
// `GET knowledge` when the view opens and one after each action here. Everyone sees it; settling a conflict, drafting or dismissing a question, accepting or
// dismissing a suggestion and Always in Context are an Editor's.
import { useState } from 'react';
import type { KnowledgeEmailResult } from '@liveknowledge/api-schema';
import { Button, EmptyState } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { AiSettingsButton, openAiSettingsFrom } from '@/components/ask/AiSettingsButton';
import { AiViewIcon } from '@/components/ask/ask-icons';
import { AgentIcon } from './ai-knowledge-icons';
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
import { apiAskConflictOwners, apiRemindOwners } from '@/lib/api/knowledge-emails';
import {
  emailFailureText,
  emailResultText,
  type OwnersEmail,
} from '@/lib/knowledge-ask/email-words';
import {
  apiAcceptKnowledgeSuggestion,
  apiDismissKnowledgeSuggestion,
  overviewFailureText,
} from '@/lib/knowledge-ask/suggestions-api';
import { knowledgeFailureText } from '@/lib/knowledge/knowledge-words';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { AiDashboard } from './AiDashboard';
import { AgentWriteDialog } from './AgentWriteDialog';
import { DashboardLoading } from './DashboardLoading';
import { useAgentWrite } from './useAgentWrite';
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
  const { drafting, draft } = useDraftPage(session, overview?.hasAi ?? false);
  const [adding, setAdding] = useState(false);
  const agentWrite = useAgentWrite({
    who,
    documentId,
    allowed: rights.grantAgents,
    agents: overview?.agents ?? null,
    refresh,
    onFailure: toast.error,
  });

  // The Connect view: the steps for each AI app, what a connection may do and the other ways in (mcp-connect.md).
  const connect = () => {
    track('UI', 'Opened', 'ConnectAgent');
    showKnowledgeView('connect');
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
  // Ask Both Owners and Remind the Owners: one request, then what happened in words (sent to two owners, already
  // reminded this week), and the overview read again for the date that takes the button's place.
  const canEmailOwners = rights.emailOwners && (overview?.reviewEmails.available ?? false);
  const emailOwners = (
    kind: OwnersEmail,
    id: string,
    send: () => Promise<KnowledgeEmailResult>,
  ) => {
    if (!canEmailOwners) return;
    track('UI', 'Used', kind === 'ask' ? 'OwnersAsked' : 'OwnersReminded');
    void run(
      id,
      async () => toast.info(emailResultText(await send(), kind, Date.now())),
      (err) => emailFailureText(err, kind),
    );
  };

  return (
    <>
      <KnowledgeViewHeader
        title="AI Knowledge"
        about="What agents know of this knowledgebase, where they learned it and what they could not find."
      >
        {/* Icon only on a phone, as AI Settings beside it: the top row has no room for both labels and Share
            (sweep 2026-11-21: they overlapped). */}
        <Button
          variant="secondary"
          size="xs"
          onClick={connect}
          aria-label="Connect an Agent"
          className="cursor-pointer"
        >
          <AgentIcon />
          <span className="phone:sr-only">Connect an Agent</span>
        </Button>
        {offline ? null : <AiSettingsButton />}
      </KnowledgeViewHeader>
      <div className="min-h-0 flex-1 overflow-y-auto" data-ai-knowledge="">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
          {offline ? (
            <EmptyState
              icon={<AiViewIcon />}
              title="No AI Knowledge in an Offline Knowledgebase"
              description="This knowledgebase is kept in this browser, where no agent can reach it and nothing is counted. Its pages and search work as they are."
            />
          ) : state.status === 'loading' ? (
            <DashboardLoading />
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
              <AiDashboard
                overview={overview}
                documentId={documentId}
                rights={rights}
                agents={agentWrite.shown}
                agentsBusy={agentWrite.busy}
                busy={busy}
                drafting={drafting}
                canEmailOwners={canEmailOwners}
                now={now}
                actions={{
                  openPage,
                  connect,
                  openAiSettings: openAiSettingsFrom,
                  askWrite: agentWrite.ask,
                  dismissConflict: (id) => {
                    if (!rights.resolve) return;
                    track('UI', 'Used', 'ConflictDismissed');
                    void run(
                      id,
                      () => apiDismissKnowledgeConflict(who, documentId, id),
                      (err) => overviewFailureText(err, 'dismiss-conflict'),
                    );
                  },
                  askOwners: (id) =>
                    emailOwners('ask', `ask:${id}`, () =>
                      apiAskConflictOwners(who, documentId, id),
                    ),
                  draft: (question) =>
                    void draft(question.question).then((made) => {
                      if (made) refresh();
                    }),
                  dismissQuestion: (key) => {
                    if (!rights.resolve) return;
                    track('UI', 'Used', 'QuestionDismissed');
                    void run(
                      key,
                      () => apiDismissKnowledgeQuestion(who, documentId, key),
                      (err) => overviewFailureText(err, 'dismiss-question'),
                    );
                  },
                  accept: (suggestion) => {
                    if (!rights.resolve) return;
                    track('UI', 'Used', 'SuggestionAccepted');
                    void run(
                      `accept:${suggestion.id}`,
                      () => apiAcceptKnowledgeSuggestion(who, documentId, suggestion.id),
                      (err) => overviewFailureText(err, 'accept-suggestion'),
                    );
                  },
                  dismissSuggestion: (suggestion) => {
                    if (!rights.resolve) return;
                    track('UI', 'Used', 'SuggestionDismissed');
                    void run(
                      `dismiss:${suggestion.id}`,
                      () => apiDismissKnowledgeSuggestion(who, documentId, suggestion.id),
                      (err) => overviewFailureText(err, 'dismiss-suggestion'),
                    );
                  },
                  remindOwners: () =>
                    emailOwners('remind', 'remind-owners', () => apiRemindOwners(who, documentId)),
                  addContext: () => setAdding(true),
                  removeContext: (tab) => {
                    if (!rights.context) return;
                    track('UI', 'Removed', 'ContextPage');
                    void setContext(tab, false);
                  },
                }}
              />
            </>
          )}
        </div>
      </div>
      <AgentWriteDialog
        ask={agentWrite.asking}
        onConfirm={() => void agentWrite.confirm()}
        onCancel={agentWrite.cancel}
      />
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
