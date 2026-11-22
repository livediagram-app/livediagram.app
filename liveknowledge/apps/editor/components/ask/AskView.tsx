'use client';

// Ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the knowledgebase's second view. Three columns on a
// wide window: the person's questions, the conversation with the question field at its foot, and the Sources of the
// answer showing. Below 1,024px they stack in that order, the recent questions folded. What the session cannot do
// is said in the conversation's place (AskStates).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { questionKey } from '@liveknowledge/knowledge';
import { apiDismissKnowledgeQuestion } from '@/lib/api/knowledge';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useKnowledgePeople } from '@/components/knowledge/usePageKnowledge';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { hasAnyAi } from '@/lib/knowledge-ask/ai-settings-words';
import {
  askConversationFor,
  chatTurns,
  recentQuestionsStore,
} from '@/lib/knowledge-ask/ask-session-store';
import { chatIdOf, type RecentQuestion } from '@/lib/knowledge-ask/recent-questions';
import { track } from '@/lib/telemetry';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { takeArrival } from '@/lib/knowledge-home/arrival-handoff';
import { useRelativeNow } from '@/lib/relative-time';
import { AiSettingsButton } from './AiSettingsButton';
import { AskConversationPane } from './AskConversationPane';
import { RecentQuestions } from './RecentQuestions';
import { AskLoading, AskNoAi, AskOffline, AskSettingsFailed, AskSignedOut } from './AskStates';
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
  else if (!hasAnyAi(settings.settings)) body = <AskNoAi manageAi={session.rights.manageAi} />;
  else body = <AskReady session={session} />;

  return (
    <>
      <KnowledgeViewHeader
        title="Ask"
        about="Answers in plain words from this knowledgebase's own pages, each part with where it came from."
      >
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
  // A question typed on the Knowledgebase Home (knowledgebase-home.md "Hero"): asked here as a new question, once.
  useEffect(() => {
    const arrival = takeArrival('ask', documentId);
    if (!arrival) return;
    conversation.reset();
    conversation.ask(arrival.question);
  }, [conversation, documentId]);

  const focusField = () =>
    document.querySelector<HTMLTextAreaElement>('[data-ask-composer] textarea')?.focus();
  const askNew = (question?: string) => {
    conversation.reset();
    setRecentOpen(false);
    if (question) conversation.ask(question);
    else focusField();
  };
  // The open chat, read as a store: the React Compiler would keep a plain `chatId()` call's first answer.
  const currentId = useSyncExternalStore(conversation.subscribe, conversation.chatId, () => null);
  const current = currentId ? recent.find((row) => chatIdOf(row) === currentId) : undefined;
  const completed = current?.completedAt !== undefined;
  // A kept chat opens with its answers; a question kept before chats were is asked again.
  const openChat = (row: RecentQuestion) => {
    setRecentOpen(false);
    if (row.turns?.length) conversation.open(chatIdOf(row), chatTurns(row));
    else askNew(row.question);
  };
  // Accept Answer: the chat goes to Completed Questions and the field is fresh.
  const accept = () => {
    if (!currentId) return;
    track('UI', 'Used', 'AskAccepted');
    recentQuestionsStore.accept(who, documentId, currentId);
    // Accepted, the chat's question and the gaps its answers named are answered: they leave Needs Attention (owner
    // 2026-11-21), for a person who may settle them. A failure leaves them listed, nothing worse.
    if (session.rights.resolve && current) {
      const keys = new Set(
        [current.question, ...(current.turns ?? []).flatMap((t) => t.gaps)].map(questionKey),
      );
      for (const key of keys)
        if (key) void apiDismissKnowledgeQuestion(who, documentId, key).catch(() => undefined);
    }
    conversation.reset();
    focusField();
  };
  const reopen = () => {
    if (!currentId) return;
    track('UI', 'Used', 'AskReopened');
    recentQuestionsStore.reopen(who, documentId, currentId);
  };
  const [deleting, setDeleting] = useState<RecentQuestion | null>(null);
  const remove = () => {
    if (!deleting) return;
    const id = chatIdOf(deleting);
    setDeleting(null);
    track('UI', 'Removed', 'AskChat');
    recentQuestionsStore.remove(who, documentId, id);
    if (conversation.chatId() === id) conversation.reset();
  };

  return (
    <div
      data-ask-layout=""
      className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
    >
      {/* slate-50, so the empty state's slate-500 line under it holds 4.5:1 (it read 4.43 on slate-100/60). */}
      <aside
        aria-label="Your Questions"
        className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r"
      >
        <RecentQuestions
          questions={recent}
          now={now}
          canAsk
          open={recentOpen}
          currentId={currentId}
          onToggle={() => setRecentOpen((open) => !open)}
          onNew={() => askNew()}
          onOpen={openChat}
          onDelete={setDeleting}
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
        completed={completed}
        onNew={() => askNew()}
        onAccept={accept}
        onReopen={reopen}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete This Question?"
        message={
          deleting
            ? `“${deleting.question}” and its answers are deleted from this browser. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
