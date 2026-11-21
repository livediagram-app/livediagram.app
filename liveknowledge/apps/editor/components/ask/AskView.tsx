'use client';

// Ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the knowledgebase's second view. Three columns on a
// wide window: the person's questions, the conversation with the question field at its foot, and the Sources of the
// answer showing. Below 1,024px they stack in that order, the recent questions folded. What the session cannot do
// is said in the conversation's place (AskStates).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useKnowledgePeople } from '@/components/knowledge/usePageKnowledge';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { askConversationFor, recentQuestionsStore } from '@/lib/knowledge-ask/ask-session-store';
import { takeAskDraft } from '@/lib/knowledge-ask/ask-draft';
import { takeArrival } from '@/lib/knowledge-home/arrival-handoff';
import { useRelativeNow } from '@/lib/relative-time';
import { AiSettingsButton } from './AiSettingsButton';
import { AskConversationPane } from './AskConversationPane';
import { RecentQuestions } from './RecentQuestions';
import {
  AskLoading,
  AskNoKey,
  AskOffline,
  AskSettingsFailed,
  AskSignedOut,
  SearchPagesButton,
} from './AskStates';
import { KnowledgeViewHeader } from './KnowledgeViewFrame';
import { useAiSettingsState, useAskSession, type AskSession } from './useAskSession';

const NO_QUESTIONS: readonly never[] = [];

export function AskView() {
  const session = useAskSession();
  const settings = useAiSettingsState(session?.documentId ?? null);
  const askOff = session?.rights.askOff ?? null;
  const who = session?.who;
  const documentId = session?.documentId;
  // Whether there is a key: asked once per knowledgebase. A knowledgebase kept Offline has no server to ask.
  useEffect(() => {
    if (who && documentId && askOff !== 'offline') void aiSettingsStore.load(who, documentId);
  }, [who, documentId, askOff]);
  if (!session) return null;

  let body;
  if (askOff === 'offline') body = <AskOffline />;
  else if (askOff === 'signed-out') body = <AskSignedOut />;
  else if (settings.status === 'failed')
    body = (
      <AskSettingsFailed
        onRetry={() => void aiSettingsStore.load(session.who, session.documentId)}
      />
    );
  else if (settings.status !== 'ready') body = <AskLoading />;
  else if (!settings.settings.hasKey) body = <AskNoKey manageAi={session.rights.manageAi} />;
  else body = <AskReady session={session} />;

  return (
    <>
      <KnowledgeViewHeader
        title="Ask"
        about="Answers in plain words from this knowledgebase's own pages, each part with where it came from."
      >
        <SearchPagesButton />
        {askOff === 'offline' ? null : <AiSettingsButton />}
      </KnowledgeViewHeader>
      {body}
    </>
  );
}

function AskReady({ session }: { session: AskSession }) {
  const { who, documentId } = session;
  const conversation = askConversationFor(who, documentId);
  const turns = useSyncExternalStore(
    conversation.subscribe,
    conversation.getTurns,
    () => NO_QUESTIONS,
  );
  const recent = useSyncExternalStore(
    recentQuestionsStore.subscribe,
    () => recentQuestionsStore.get(who, documentId),
    () => NO_QUESTIONS,
  );
  const pages = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const activePageId = useEditorChrome((s) => s.activeId);
  const { nameOf } = useKnowledgePeople();
  const now = useRelativeNow();
  const [recentOpen, setRecentOpen] = useState(false);
  // Words Ask About This Page left for the field: taken once, on a new question.
  const [draft] = useState(() => takeAskDraft(documentId));
  useEffect(() => {
    if (draft) conversation.reset();
  }, [draft, conversation]);

  // A question typed on the Knowledgebase Home (knowledgebase-home.md "Hero"): asked here as a new question, once.
  useEffect(() => {
    const arrival = takeArrival('ask', documentId);
    if (!arrival) return;
    conversation.reset();
    conversation.ask(arrival.question);
  }, [conversation, documentId]);

  const askNew = (question?: string) => {
    conversation.reset();
    setRecentOpen(false);
    if (question) conversation.ask(question);
    else document.querySelector<HTMLTextAreaElement>('[data-ask-composer] textarea')?.focus();
  };

  return (
    <div
      data-ask-layout=""
      className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
    >
      <aside
        aria-label="Your Questions"
        className="shrink-0 border-b border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/50 lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r"
      >
        <RecentQuestions
          questions={recent}
          now={now}
          canAsk
          open={recentOpen}
          onToggle={() => setRecentOpen((open) => !open)}
          onNew={() => askNew()}
          onAsk={askNew}
        />
      </aside>
      <AskConversationPane
        session={session}
        conversation={conversation}
        turns={turns}
        pages={pages}
        activePageId={activePageId}
        nameOf={nameOf}
        now={now}
        onNew={() => askNew()}
        waiting={draft ?? undefined}
      />
    </div>
  );
}
