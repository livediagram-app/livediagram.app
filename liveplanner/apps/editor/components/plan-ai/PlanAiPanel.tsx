'use client';

// Plan AI's panel (docs/specs/026-plan/plan-ai.md "The panel"): over the AI button beside Card Types, the same Ask as
// Tools' (its question box and AI pill, @liveworkspace/ask/composer), on the open tab. Each turn shows what was asked,
// the answer, what its changes did, and an Undo that takes them back. A guest is asked to sign in; a Viewer asks and
// is answered, and nothing changes.
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  AnswerWith,
  AskComposer,
  answeredBy,
  askAiChoiceStore,
  askAiView,
  useAskAiChoice,
} from '@liveworkspace/ask/composer';
import { useAiSource, type AiSourceEvent } from '@liveworkspace/settings-ui/ai-source';
import { ButtonContent, CompactEmptyState, SparkleIcon, buttonClassName } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import {
  accountDoor,
  useEditorAiScope,
} from '@liveworkspace/workbench/components/ai/ai-source-scope';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { requestOpenSettings } from '@liveworkspace/workbench/lib/open-settings';
import { PLAN_AI_WORDS, type PlanAiKind } from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { usePlan } from '@/components/plan/PlanContext';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { track } from '@/lib/telemetry';
import { planAiHeroArt } from './PlanAiHeroArt';
import { PlanAiTurn } from './PlanAiTurn';
import { usePlanAiHost } from './usePlanAiHost';
import { usePlanAiRun } from './usePlanAiRun';
import { planAiThread, subscribePlanAi } from './plan-ai-thread';

type Provider = Parameters<typeof answeredBy>[0];

// The thread follows a new turn while its foot is within this of the bottom.
const FOLLOW_WITHIN_PX = 80;

const openAiSettings = () => requestOpenSettings('ai');
const trackSource = (event: AiSourceEvent) =>
  event === 'opened'
    ? track('UI', 'Opened', 'AiSourceSettings')
    : track('UI', 'Added', 'AiSourceKey');

/** What each kind of tab is called, and what to try on it. */
export const PLAN_AI_KIND_WORDS: Readonly<
  Record<PlanAiKind, { noun: string; does: string; suggestions: readonly string[] }>
> = {
  board: {
    noun: 'board',
    does: 'Ask about its cards, or tell AI to add, change or move them.',
    suggestions: [
      'Which cards have no assignee?',
      'Add cards for planning a team offsite',
      'Move every card that is due this week to the first column',
    ],
  },
  sheet: {
    noun: 'sheet',
    does: 'Ask about its numbers, or tell AI to fill cells, add formulas and totals, sort, format or chart them.',
    suggestions: [
      'Add a total under each column of numbers',
      'Make a chart of this data',
      'Start a monthly budget with income and spending',
    ],
  },
  form: {
    noun: 'form',
    does: 'Ask about its questions, or tell AI to add, reword or reorder them.',
    suggestions: [
      'Add a question asking for an email address',
      'Reword the questions to sound friendlier',
      'Make every question required',
    ],
  },
  dashboard: {
    noun: 'dashboard',
    does: 'Ask about its layout, or tell AI to add, remove or resize its rows and slots.',
    suggestions: [
      'Add a row with two slots at the top',
      'Make the first slot of the first row wider',
      'Put a note about this week in an empty slot',
    ],
  },
};

const SUGGESTION =
  'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[13.5px] font-medium text-slate-800 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-300 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-slate-800';

function SignedOut() {
  const { signInHref } = useAuthHrefs();
  return (
    <CompactEmptyState
      icon={<SparkleIcon size={18} />}
      title="Sign In to Use AI"
      description="Ask about this tab, or tell AI what to change, once you are signed in."
      className="px-4 pb-5 pt-1"
      action={
        <a
          href={signInHref}
          data-plan-ai-sign-in=""
          className={buttonClassName({ variant: 'primary', size: 'sm' })}
        >
          <ButtonContent>Sign In</ButtonContent>
        </a>
      }
    />
  );
}

export function PlanAiPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const ctx = useEditorContext();
  return (
    <MovablePanel
      title="AI"
      hero={{ art: planAiHeroArt }}
      helpArticle="planAi"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-[26rem]"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-[calc(100vw-2rem)] sm:w-[26rem]"
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      {ctx.accountUserId ? <PlanAiThread /> : <SignedOut />}
    </MovablePanel>
  );
}

function PlanAiThread() {
  const ctx = useEditorContext();
  const plan = usePlan();
  const { kind, role, latest } = usePlanAiHost(ctx, plan);
  const tabId = ctx.activeTab.id;
  const turns = useSyncExternalStore(
    subscribePlanAi,
    () => planAiThread(tabId),
    () => planAiThread(tabId),
  );
  const scope = useEditorAiScope();
  const choice = useAskAiChoice();
  const failure = turns[turns.length - 1]?.failure?.aiKey ?? null;
  const { line, act } = useAiSource({
    request: accountDoor(),
    teamId: scope.teamId,
    failure,
    openSettings: openAiSettings,
    track: trackSource,
  });
  const view = askAiView(line, choice);
  const { ask, stop, undo, clear } = usePlanAiRun({
    tabId,
    latest,
    role,
    ownerId: ctx.selfParticipant.id,
    projectId: ctx.projectId ?? '',
    teamId: scope.teamId,
    builtIn: view.using === 'built-in' && !!view.key,
    undo: ctx.undo,
  });
  const asking = turns[turns.length - 1]?.status === 'asking';

  const thread = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    const el = thread.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  if (!kind)
    return (
      <CompactEmptyState
        size="small"
        icon={<SparkleIcon size={16} />}
        title="Open a Board, Sheet, Form or Dashboard"
        description="AI works on the tab that is open."
        className="pb-4 pt-1"
      />
    );
  const words = PLAN_AI_KIND_WORDS[kind];
  const newest = turns[turns.length - 1];
  const send = (text: string) => {
    following.current = true;
    return ask(text);
  };
  return (
    <div
      data-plan-ai=""
      data-plan-ai-kind={kind}
      className="flex max-h-[min(40rem,calc(100dvh-20rem))] min-h-0 flex-col"
    >
      <div
        ref={thread}
        onScroll={(event) => {
          const el = event.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_WITHIN_PX;
        }}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-3 pt-1"
      >
        {role === 'view' ? (
          <Callout tone="info" size="sm" title="You Can View This Plan">
            AI answers your questions, and changes nothing.
          </Callout>
        ) : null}
        {turns.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <CompactEmptyState
              icon={<SparkleIcon size={18} />}
              title="Ask or Tell AI"
              description={role === 'view' ? `Ask about this ${words.noun}.` : words.does}
            />
            <div className="flex w-full flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Try
              </p>
              {(role === 'view' ? words.suggestions.slice(0, 1) : words.suggestions).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-plan-ai-suggestion=""
                  onClick={() => send(s)}
                  className={SUGGESTION}
                >
                  <span className="min-w-0 flex-1">{s}</span>
                  <SparkleIcon aria-hidden size={14} className="shrink-0 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <PlanAiTurn
              key={turn.id}
              turn={turn}
              answered={answeredBy(turn.provider as Provider, undefined, line)}
              canUndo={turn === newest && turn.steps > 0 && !turn.undone}
              onUndo={() => undo(turn.id)}
              onAskAgain={() => send(turn.instruction)}
            />
          ))
        )}
      </div>
      <div className="shrink-0 px-4 pb-4 pt-2">
        <AskComposer
          label={
            role === 'view'
              ? `Ask about this ${words.noun}`
              : `Ask or tell AI about this ${words.noun}`
          }
          followUpLabel="Ask or tell AI more"
          followUp={turns.length > 0}
          streaming={asking}
          onAsk={send}
          onStop={stop}
          onNewChat={turns.length > 0 ? clear : null}
          pill={
            <AnswerWith
              app="liveplanner"
              view={view}
              manage={act}
              onPick={(next) => {
                track('UI', 'Changed', next === 'built-in' ? 'AskAiBuiltIn' : 'AskAiKey');
                askAiChoiceStore.set(next);
              }}
            />
          }
        />
        <p className="sr-only" role="status">
          {asking ? 'Working on it' : newest?.status === 'failed' ? PLAN_AI_WORDS.failed : ''}
        </p>
      </div>
    </div>
  );
}
