'use client';

// Ask AI, inside the footer's Tools (liveworkspace/docs/specs/019-ask/ask.md "The tool"): the conversation as a
// thread, the question field at its foot with the AI pill, and each answer's sources in a popover beside Tools. For a
// signed-in person; a guest is asked to sign in.
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useAiSource, type AiSourceEvent } from '@liveworkspace/settings-ui/ai-source';
import {
  ButtonContent,
  CompactEmptyState,
  ResponsivePopover,
  SparkleIcon,
  TextArea,
  Tooltip,
  buttonClassName,
  isComposingKey,
  useCopiedFlash,
} from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { workbench } from '@liveworkspace/workbench/bindings';
import {
  accountDoor,
  useEditorAiScope,
} from '@liveworkspace/workbench/components/ai/ai-source-scope';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import type { ToolViewContext } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { requestOpenSettings } from '@liveworkspace/workbench/lib/open-settings';
import { answerWithoutMarkers } from '../answer-parts';
import { ASK_MAX_QUESTION_CHARS } from '../limits';
import type { AskSource } from '../wire';
import { AnswerText } from './AnswerText';
import { AnswerWith } from './AnswerWith';
import { askAiChoiceStore, useAskAiChoice } from './ask-ai-choice';
import { askSender } from './ask-client';
import { CopiedIcon, CopyIcon, SendIcon, SignInIcon, StopIcon } from './ask-icons';
import { answeredBy, askAiView, itemWords, nothingToReadWords } from './ask-words';
import { ASK_SOURCES_WIDTH_PX, AskSources } from './AskSources';
import { NUMBER_CHIP } from './CitationChip';
import { conversationOf, type AskConversation, type AskTurnView } from './conversation';
import type { AskHost } from './host';

/** The count shows from here on. */
export const ASK_COUNT_FROM = ASK_MAX_QUESTION_CHARS - 100;
// The field grows with its writing up to this height, then scrolls.
const MAX_FIELD_HEIGHT_PX = 120;
// The thread follows a growing answer while its foot is within this of the bottom.
const FOLLOW_WITHIN_PX = 80;

const ICON_BUTTON =
  'touch-target relative flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';
const ROUND_BUTTON =
  'touch-target relative flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none motion-safe:transition-colors motion-safe:duration-micro focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900';
const QUIET_BUTTON =
  'touch-target relative shrink-0 cursor-pointer rounded-full px-2 py-1.5 text-[12.5px] font-semibold text-slate-600 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

const openAiSettings = () => requestOpenSettings('ai');
const trackSource = (event: AiSourceEvent) =>
  event === 'opened'
    ? workbench.track('UI', 'Opened', 'AiSourceSettings')
    : workbench.track('UI', 'Added', 'AiSourceKey');

/** What going to a source is called, by what the app calls its item. */
export const goWordsOf = (noun: string): string => `Show in ${noun}`;

type SourcesOpen = { turnId: string; lit: number | null };

const Turn = memo(function Turn({
  turn,
  conversation,
  answered,
  onSources,
  pillRef,
}: {
  turn: AskTurnView;
  conversation: AskConversation;
  /** Which AI answered, by name; null until it has. */
  answered: string | null;
  onSources: (turnId: string, lit: number | null) => void;
  pillRef: (turnId: string, node: HTMLButtonElement | null) => void;
}) {
  const { copied, flash } = useCopiedFlash(2000);
  const titles = useMemo(
    () => new Map(turn.sources.map((source) => [source.number, source.title])),
    [turn.sources],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answerWithoutMarkers(turn.text).trim());
    } catch {
      return;
    }
    workbench.track('UI', 'Used', 'AskAiCopy');
    flash();
  };
  const count = turn.sources.length;
  return (
    <div data-ask-turn={turn.id} data-status={turn.status} className="flex flex-col gap-3">
      <p className="max-w-[86%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-[4px] bg-brand-700 px-3 py-2 text-sm leading-5 text-white dark:bg-brand-600">
        <span className="sr-only">You asked: </span>
        {turn.question}
      </p>
      {turn.status === 'failed' && !turn.text ? null : (
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-px flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
          >
            <SparkleIcon size={13} />
          </span>
          <article
            aria-label="Answer"
            aria-busy={turn.status === 'streaming'}
            className="min-w-0 flex-1 text-sm leading-[23px] text-slate-800 dark:text-slate-200"
          >
            {turn.status === 'done' ? (
              <AnswerText
                text={turn.text}
                titles={titles}
                onCite={(number) => onSources(turn.id, number)}
              />
            ) : turn.text ? (
              // While it streams it is plain text: nothing in it is read as markup. Heard whole, once it has ended.
              <p
                aria-hidden={turn.status === 'streaming'}
                className="whitespace-pre-wrap break-words"
              >
                {answerWithoutMarkers(turn.text)}
              </p>
            ) : null}
            {turn.status === 'streaming' && !turn.text ? (
              <span
                role="status"
                className="text-slate-600 motion-safe:animate-pulse dark:text-slate-400"
              >
                Reading…
              </span>
            ) : null}
            {turn.status === 'stopped' ? (
              <p className="mt-2 text-[12.5px] leading-5 text-slate-600 dark:text-slate-400">
                {turn.text
                  ? 'Stopped. What had arrived is kept.'
                  : 'Stopped before anything arrived.'}
              </p>
            ) : null}
            {turn.status === 'done' ? (
              <div className="mt-2 flex items-center gap-1.5">
                {count > 0 ? (
                  <button
                    ref={(node) => pillRef(turn.id, node)}
                    type="button"
                    data-ask-sources-pill=""
                    aria-haspopup="dialog"
                    onClick={() => onSources(turn.id, null)}
                    className="touch-target relative flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-brand-200 bg-brand-50 py-1 pl-1.5 pr-2.5 text-[12.5px] font-semibold text-brand-800 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-brand-100 dark:hover:bg-brand-500/20"
                  >
                    <span aria-hidden className="flex">
                      {turn.sources.slice(0, 3).map((source, at) => (
                        <span
                          key={source.id}
                          className={`${NUMBER_CHIP} ring-[1.5px] ring-brand-50 dark:ring-slate-900 ${at ? '-ml-1' : ''}`}
                        >
                          <span className="text-optical-centre">{source.number}</span>
                        </span>
                      ))}
                    </span>
                    {count} {count === 1 ? 'Source' : 'Sources'}
                  </button>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-right text-[12px] text-slate-600 dark:text-slate-400">
                  {answered ? (
                    <>
                      <span className="sr-only">Answered by </span>
                      {answered}
                    </>
                  ) : null}
                </span>
                <Tooltip label={copied ? 'Copied' : 'Copy Answer'}>
                  <button
                    type="button"
                    aria-label="Copy Answer"
                    onClick={() => void copy()}
                    className={ICON_BUTTON}
                  >
                    {copied ? <CopiedIcon /> : <CopyIcon />}
                    <span role="status" className="sr-only">
                      {copied ? 'Copied' : ''}
                    </span>
                  </button>
                </Tooltip>
              </div>
            ) : null}
          </article>
        </div>
      )}
      {turn.status === 'failed' && turn.failure ? (
        <Callout
          tone="warning"
          size="md"
          role="alert"
          title="That Could Not Be Answered"
          action={{ label: 'Ask Again', onSelect: () => conversation.askAgain(turn.id) }}
        >
          {turn.failure.message}
        </Callout>
      ) : null}
    </div>
  );
});

function Composer({
  noun,
  followUp,
  streaming,
  onAsk,
  onStop,
  onNewChat,
  pill,
}: {
  noun: string;
  followUp: boolean;
  streaming: boolean;
  // False when the question was not taken (the field then keeps it).
  onAsk: (question: string) => boolean;
  onStop: () => void;
  onNewChat: (() => void) | null;
  pill: ReactNode;
}) {
  const [value, setValue] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const countId = useId();
  const length = value.length;
  const ready = value.trim() !== '' && !streaming;

  // As tall as its writing, up to the cap.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_HEIGHT_PX)}px`;
  }, [value]);
  // Opening the tool puts the caret in the field, ready to type (after the back bar's own first focus).
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const send = () => {
    if (!ready) return;
    if (onAsk(value)) setValue('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method is composing confirms the word, it does not send.
    if (event.key !== 'Enter' || event.shiftKey || isComposingKey(event)) return;
    event.preventDefault();
    send();
  };
  return (
    <form
      data-ask-composer=""
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="flex flex-col gap-1.5 rounded-[18px] border border-slate-300 bg-white py-2 pl-3.5 pr-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-900"
    >
      <TextArea
        ref={field}
        rows={1}
        value={value}
        maxLength={ASK_MAX_QUESTION_CHARS}
        disabled={streaming}
        aria-label={followUp ? 'Ask a follow-up' : `Ask this ${noun} a question`}
        aria-describedby={length >= ASK_COUNT_FROM ? countId : undefined}
        placeholder={followUp ? 'Ask a follow-up' : `Ask this ${noun} a question`}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-[30px] w-full resize-none !border-0 !bg-transparent !px-0 !py-1 !shadow-none !outline-none !ring-0"
      />
      <div className="flex min-w-0 items-center gap-1.5">
        {pill}
        <span className="flex-1" />
        {length >= ASK_COUNT_FROM ? (
          <span
            id={countId}
            role="status"
            data-ask-count=""
            className={`shrink-0 text-xs tabular-nums ${
              length >= ASK_MAX_QUESTION_CHARS
                ? 'font-semibold text-amber-800 dark:text-amber-200'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {length.toLocaleString('en')} / {ASK_MAX_QUESTION_CHARS.toLocaleString('en')}
          </span>
        ) : null}
        {onNewChat ? (
          <Tooltip label="New Chat">
            <button type="button" data-ask-new-chat="" onClick={onNewChat} className={QUIET_BUTTON}>
              New Chat
            </button>
          </Tooltip>
        ) : null}
        {streaming ? (
          <Tooltip label="Stop">
            <button
              type="button"
              aria-label="Stop"
              onClick={onStop}
              className={`${ROUND_BUTTON} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
            >
              <StopIcon />
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Send">
            <button
              type="submit"
              aria-label="Send"
              disabled={!ready}
              className={`${ROUND_BUTTON} bg-brand-700 text-white enabled:hover:bg-brand-800 dark:bg-brand-600 dark:enabled:hover:bg-brand-500`}
            >
              <SendIcon />
            </button>
          </Tooltip>
        )}
      </div>
    </form>
  );
}

function SignedOut({ noun }: { noun: string }) {
  const { signInHref } = useAuthHrefs();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <CompactEmptyState
        icon={<SparkleIcon size={18} />}
        title="Sign In to Ask AI"
        description={`Ask a question and get an answer from this ${noun}, with the places it came from.`}
        action={
          <a
            href={signInHref}
            className={buttonClassName({ variant: 'primary', size: 'sm' })}
            data-ask-sign-in=""
          >
            <ButtonContent>
              <SignInIcon aria-hidden />
              Sign In
            </ButtonContent>
          </a>
        }
      />
    </div>
  );
}

export function AskTool({ host }: { host: AskHost; ctx?: ToolViewContext }) {
  const { noun, lower } = itemWords(host.app);
  if (!host.accountId) return <SignedOut noun={lower} />;
  return <AskThread host={host} accountId={host.accountId} noun={noun} lower={lower} />;
}

function AskThread({
  host,
  accountId,
  noun,
  lower,
}: {
  host: AskHost;
  accountId: string;
  noun: string;
  lower: string;
}) {
  const scope = useEditorAiScope();
  const conversation = conversationOf(host.itemId);
  const turns = useSyncExternalStore(
    conversation.subscribe,
    conversation.turns,
    conversation.turns,
  );
  const choice = useAskAiChoice();
  const streaming = turns[turns.length - 1]?.status === 'streaming';
  const failure = turns[turns.length - 1]?.failure?.aiKey ?? null;
  const { line, act } = useAiSource({
    request: accountDoor(),
    teamId: scope.teamId,
    failure,
    openSettings: openAiSettings,
    track: trackSource,
  });
  const view = askAiView(line, choice);
  const send = useMemo(() => askSender(accountId), [accountId]);

  // The newest host, read when a question is asked.
  const live = useRef({
    host,
    teamId: scope.teamId,
    builtIn: view.using === 'built-in' && !!view.key,
  });
  useEffect(() => {
    live.current = { host, teamId: scope.teamId, builtIn: view.using === 'built-in' && !!view.key };
    conversation.bind({
      send,
      passages: () => live.current.host.passages(),
      teamId: () => live.current.teamId,
      builtIn: () => live.current.builtIn,
      nothingToRead: nothingToReadWords(host.app),
    });
  });

  // The thread keeps its foot in view as an answer grows, unless the person has scrolled up to read.
  const thread = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    const el = thread.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const root = useRef<HTMLDivElement>(null);
  const pills = useRef(new Map<string, HTMLButtonElement>());
  const pillRef = useCallback((turnId: string, node: HTMLButtonElement | null) => {
    if (node) pills.current.set(turnId, node);
    else pills.current.delete(turnId);
  }, []);
  const [sources, setSources] = useState<SourcesOpen | null>(null);
  // What Sources opens beside: the surface the tool is in (Tools), else the answer's own Sources pill.
  const [sourcesAnchor, setSourcesAnchor] = useState<HTMLElement | null>(null);
  const sourcesTitleId = useId();
  const openSources = useCallback((turnId: string, lit: number | null) => {
    workbench.track('UI', 'Opened', 'AskAiSources');
    setSourcesAnchor(
      root.current?.closest<HTMLElement>('[role="dialog"]') ?? pills.current.get(turnId) ?? null,
    );
    setSources({ turnId, lit });
  }, []);
  const closeSources = useCallback(() => {
    // The focus goes back to the answer's Sources pill, which opened them or sits by the citation that did.
    setSources((open) => {
      if (open) pills.current.get(open.turnId)?.focus({ preventScroll: true });
      return null;
    });
  }, []);
  const shown = sources ? turns.find((turn) => turn.id === sources.turnId) : undefined;
  const goWords = goWordsOf(noun);

  const ask = (question: string): boolean => {
    following.current = true;
    const taken = conversation.ask(question);
    if (taken) workbench.track('UI', 'Used', 'AskAi');
    return taken;
  };
  const open = (source: AskSource) => {
    workbench.track('UI', 'Opened', 'AskAiSource');
    host.open(source);
  };

  return (
    <div ref={root} data-ask-tool="" className="flex min-h-0 flex-1 flex-col">
      <div
        ref={thread}
        onScroll={(event) => {
          const el = event.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_WITHIN_PX;
        }}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-3 pt-1"
      >
        {turns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
            <CompactEmptyState
              icon={<SparkleIcon size={18} />}
              title={`Ask About This ${noun}`}
              description={`Answers come from this ${lower}'s own words, and each one shows the places it came from.`}
            />
            {host.suggestions?.length ? (
              <div className="flex w-full flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Try Asking
                </p>
                {host.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    data-ask-suggestion=""
                    onClick={() => ask(suggestion)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[13.5px] font-medium text-slate-800 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-300 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-slate-800"
                  >
                    <span className="min-w-0 flex-1">{suggestion}</span>
                    <SendIcon aria-hidden size={14} className="shrink-0 text-slate-500" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          turns.map((turn) => (
            <Turn
              key={turn.id}
              turn={turn}
              conversation={conversation}
              answered={answeredBy(turn.provider, turn.model, line)}
              onSources={openSources}
              pillRef={pillRef}
            />
          ))
        )}
      </div>
      <div className="shrink-0 px-4 pb-4 pt-2">
        <Composer
          noun={lower}
          followUp={turns.length > 0}
          streaming={streaming}
          onAsk={ask}
          onStop={() => conversation.stop()}
          onNewChat={
            turns.length > 0
              ? () => {
                  setSources(null);
                  conversation.clear();
                }
              : null
          }
          pill={
            <AnswerWith
              app={host.app}
              view={view}
              manage={act}
              onPick={(next) => {
                workbench.track('UI', 'Changed', next === 'built-in' ? 'AskAiBuiltIn' : 'AskAiKey');
                askAiChoiceStore.set(next);
              }}
            />
          }
        />
      </div>
      <ResponsivePopover
        open={!!shown && sourcesAnchor !== null}
        onClose={closeSources}
        anchor={sourcesAnchor}
        titleId={sourcesTitleId}
        width={ASK_SOURCES_WIDTH_PX}
        placement="side"
        bare
      >
        {shown ? (
          <AskSources
            titleId={sourcesTitleId}
            question={shown.question}
            sources={shown.sources}
            lit={sources?.lit ?? null}
            goWords={goWords}
            onOpen={open}
            onClose={closeSources}
          />
        ) : null}
      </ResponsivePopover>
    </div>
  );
}
