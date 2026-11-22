'use client';

// The conversation and its Sources (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): each
// question a dark bubble at the right, each answer a card, a Knowledge Gap card for each part no page covers, the
// question field at the foot, and beside them the passages of the answer showing. Nothing here renders while an
// answer streams: the stream draws itself (StreamingAnswer) and the turn list is the same list until it ends.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AskSource } from '@liveknowledge/api-schema';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY, ASK_MAX_TURNS } from '@liveknowledge/knowledge';
import { EmptyState } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';
import type { AskConversation, AskTurnView } from '@/lib/knowledge-ask/ask-conversation';
import { saveAnswerAsPage } from '@/lib/knowledge-ask/make-page';
import { BLOCK_HIT_MS } from '@/lib/knowledge/go-to-block';
import { KnowledgeAiSource } from './KnowledgeAiSource';
import { track } from '@/lib/telemetry';
import { AskAnswerCard } from './AskAnswerCard';
import { AskComposer } from './AskComposer';
import { AskSourcesRail, type SourcePage } from './AskSourcesRail';
import { AskViewIcon } from './ask-icons';
import { KnowledgeGapCard } from './KnowledgeGapCard';
import { openPassage } from './open-passage';
import { PagePickerDialog } from './PagePickerDialog';
import { useDraftPage } from './useDraftPage';
import { answeredByLabel, offersAiChoice, useAskAiChoice } from '@/lib/knowledge-ask/ask-ai-choice';
import { AskAiPicker } from './AskAiPicker';
import { useAiSettingsState, type AskSession } from './useAskSession';

const QUESTION_BUBBLE =
  'ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-[15px] leading-6 text-white dark:bg-slate-100 dark:text-slate-900';

export function AskConversationPane({
  session,
  conversation,
  turns,
  pages,
  activePageId,
  nameOf,
  now,
  completed,
  onNew,
  onAccept,
  onReopen,
}: {
  session: AskSession;
  conversation: AskConversation;
  turns: readonly AskTurnView[];
  pages: readonly SourcePage[];
  activePageId: string;
  nameOf: (id: string | undefined) => string | undefined;
  now: number;
  /** The chat showing was accepted: it is read here, with Reopen in place of the field. */
  completed: boolean;
  onNew: () => void;
  onAccept: () => void;
  onReopen: () => void;
}) {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const { rights } = session;
  // Whose key the knowledgebase holds, for a failure that is the provider's own.
  const ai = useAiSettingsState(session.documentId);
  const settings = ai.status === 'ready' ? ai.settings : null;
  // With a key set and built-in AI here, the person chooses which answers (search-and-ask.md "Choosing which AI
  // answers"); else the quiet line says which does.
  const choosing = settings !== null && offersAiChoice(settings);
  const choice = useAskAiChoice(session.who, session.documentId);
  const provider = settings
    ? settings.hasKey && !(choosing && choice === 'built-in')
      ? settings.provider
      : 'built-in'
    : undefined;
  const last = turns[turns.length - 1];
  const streaming = last?.status === 'streaming';

  // The answer whose Sources show: the one a citation was pressed in, else the newest. `lit` is the pressed source,
  // for as long as a found block stays lit on a page.
  const [shown, setShown] = useState<{ turnId: string; lit: number | null } | null>(null);
  const shownTurn = (shown && turns.find((turn) => turn.id === shown.turnId)) || last || null;
  const lit = shown && shownTurn?.id === shown.turnId ? shown.lit : null;
  useEffect(() => {
    if (lit === null) return;
    const timer = window.setTimeout(
      () => setShown((held) => (held ? { ...held, lit: null } : held)),
      BLOCK_HIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [lit, shown?.turnId]);
  const cite = useCallback(
    (turnId: string, number: number) => setShown({ turnId, lit: number }),
    [],
  );

  // The foot of the conversation stays in view while an answer grows, unless the person has scrolled away from it.
  const foot = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = foot.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) pinned.current = entry.isIntersecting;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const keepFoot = useCallback(() => {
    if (pinned.current) foot.current?.scrollIntoView?.({ block: 'end' });
  }, []);
  // A new question is where the eye goes.
  useEffect(() => {
    pinned.current = true;
    foot.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length]);

  const { drafting, draft } = useDraftPage(session, true);

  // Save as Page: the answer becomes a subpage of a chosen page.
  const [saving, setSaving] = useState<string | null>(null);
  const savingTurn = saving ? turns.find((turn) => turn.id === saving) : undefined;
  const requestSave = useCallback((turnId: string) => setSaving(turnId), []);
  const save = (parent: string) => {
    if (!savingTurn || !rights.makePages) return;
    const made = saveAnswerAsPage(chrome.get(), {
      question: savingTurn.question,
      text: savingTurn.text,
      sources: savingTurn.sources,
      parent,
    });
    setSaving(null);
    if (!made.ok) {
      toast.error(made.reason);
      return;
    }
    track('Tab', 'Created', 'FromAnswer');
    toast.action({
      key: `answer-page-${made.id}`,
      message: `Saved as “${made.title}”`,
      actions: [
        {
          label: 'Open',
          ariaLabel: `Open ${made.title}`,
          onSelect: () => void openPassage(chrome, made.id),
        },
      ],
    });
  };

  const openSource = useCallback(
    (source: AskSource) => {
      if (!openPassage(chrome, source.tab, source.firstBlock))
        toast.info('That page is no longer in this knowledgebase.');
    },
    [chrome, toast],
  );

  return (
    <>
      <section
        aria-label="Conversation"
        className="flex shrink-0 flex-col lg:min-w-0 lg:flex-1 lg:shrink"
      >
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto" data-ask-scroller="">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-6">
            {turns.length === 0 ? (
              <EmptyState
                icon={<AskViewIcon />}
                title="No Questions Yet"
                description="Ask in plain words. The answer comes from this knowledgebase's pages, cites each one, and says so when they do not cover something."
              />
            ) : (
              turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-5">
                  <p className={QUESTION_BUBBLE}>
                    <span className="sr-only">You asked: </span>
                    {turn.question}
                  </p>
                  <AskAnswerCard
                    turn={turn}
                    conversation={conversation}
                    manageAi={rights.manageAi}
                    provider={provider}
                    answeredBy={choosing ? answeredByLabel(turn, settings) : null}
                    canSave={rights.makePages}
                    onCite={cite}
                    onSave={requestSave}
                    onGrow={turn.status === 'streaming' ? keepFoot : undefined}
                    // Accept Answer is on the latest answer, once it has ended with one.
                    onAccept={
                      !completed && turn === last && turn.status === 'done' && turn.text
                        ? onAccept
                        : undefined
                    }
                  />
                  {turn.status === 'done'
                    ? turn.gaps.map((gap) => (
                        <KnowledgeGapCard
                          key={gap}
                          question={gap}
                          canDraft={rights.makePages}
                          drafting={drafting === gap}
                          busy={drafting !== null}
                          onDraft={() => void draft(gap)}
                        />
                      ))
                    : null}
                </div>
              ))
            )}
            {/* Said once when an answer ends, in place of a token at a time. */}
            <p role="status" className="sr-only">
              {streaming ? 'Answering.' : last?.status === 'done' ? 'The answer is ready.' : ''}
            </p>
            <div ref={foot} aria-hidden className="h-px" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-slate-50/95 px-4 pb-4 pt-2 backdrop-blur-sm dark:bg-slate-950/95 lg:static">
          <div className="mx-auto w-full max-w-3xl">
            {completed ? (
              <Callout
                tone="success"
                size="md"
                role="status"
                action={{ label: 'Reopen', onSelect: onReopen }}
              >
                You accepted this answer. Reopen the question to keep asking.
              </Callout>
            ) : conversation.isFull() && !streaming ? (
              <Callout
                tone="info"
                size="md"
                role="status"
                action={{ label: 'New Question', onSelect: onNew }}
              >
                This conversation has its {ASK_MAX_TURNS} questions. Start a new question to keep
                asking.
              </Callout>
            ) : (
              <AskComposer
                streaming={streaming}
                followUp={turns.length > 0}
                onAsk={conversation.ask}
                onStop={() => {
                  track('UI', 'Ended', 'AskStopped');
                  conversation.stop();
                }}
              />
            )}
            <p className="mt-1.5 text-center text-xs text-slate-600 dark:text-slate-400">
              Answers come from this knowledgebase alone. Check the sources before you rely on one.
            </p>
            {choosing ? null : (
              <div data-ask-ai="" className="mx-auto mt-2 w-full max-w-xl">
                <KnowledgeAiSource
                  state={ai}
                  who={session.who}
                  documentId={session.documentId}
                  manageAi={rights.manageAi}
                  allowance={`${ASK_BUILT_IN_PER_PERSON_PER_DAY} questions a person a day.`}
                />
              </div>
            )}
            {choosing ? (
              <div
                data-ask-ai-choice=""
                className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
              >
                <span aria-hidden className="text-xs text-slate-600 dark:text-slate-400">
                  Answer With
                </span>
                <AskAiPicker
                  who={session.who}
                  documentId={session.documentId}
                  settings={settings}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <aside
        aria-label="Sources"
        className="shrink-0 border-t border-slate-200 dark:border-slate-800 lg:w-[22rem] lg:overflow-y-auto lg:border-l lg:border-t-0"
      >
        <AskSourcesRail
          turn={shownTurn}
          pages={pages}
          nameOf={nameOf}
          now={now}
          lit={lit}
          onOpen={openSource}
        />
      </aside>
      {savingTurn ? (
        <PagePickerDialog
          title="Save as Page"
          about="The answer becomes a subpage of the page you choose, with its sources linked."
          confirmLabel="Save as Page"
          pages={pages}
          initial={pages.some((page) => page.id === activePageId) ? activePageId : undefined}
          onPick={save}
          onClose={() => setSaving(null)}
        />
      ) : null}
    </>
  );
}
