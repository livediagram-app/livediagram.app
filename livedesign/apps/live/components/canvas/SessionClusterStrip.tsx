'use client';

import { formatTimerClock, timerDone, timerDisplayMs, type TabTimer } from '@livepages/document';
import { HoverCard, SOLID_BRAND_DARK } from '@livepages/ui';
import { PollMenuIcon, TimerMenuIcon, VoteMenuIcon } from '@/components/palette/context-menu-icons';
import { timerFillStyle } from '@/components/chrome/timer-pill';
import { useNow } from '@/hooks/ui/useNow';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';

// The Session strip in the bottom-right cluster (docs/specs/012-collaboration/session-tools.md "The Session
// strip"): Timer, Vote and Poll in one strip left of Layers, as Plan mode's buttons share one. Each
// opens its tool above it, set-up while idle and the live tool while it runs. An editor always has
// the three; a view-role visitor, who cannot start anything, gets only the ones running. The Timer
// shows its clock while a timer runs, so the time reads without opening anything, and the Vote
// carries your dots left while casting is open (the number the vote banner used to float over the
// canvas), then an amber dot while the results are walked through.

export type SessionSegment = 'session-timer' | 'session-vote' | 'session-poll';

// Which tools a mode's strip offers (docs/specs/012-collaboration/session-tools.md "The Session strip"):
// all three in Workshop (docs/specs/012-collaboration/workshop-mode.md); Timer and Vote in Plan, where cards take
// the dots, only while `planVoting` (usePlanVoting: a board on the tab made for voting, or a session running);
// in Pages, Vote and Poll only while one runs (`runningOnly`), so a vote or poll started from a
// session button there can be watched and ended; none in Diagram or Draw, even while a tool runs.
export type SessionStripTools = {
  timer: boolean;
  vote: boolean;
  poll: boolean;
  // Only the buttons of tools that are running, for everyone: nothing is started from the strip.
  runningOnly?: boolean;
};

export function sessionStripTools(
  mode: string | undefined,
  planVoting = true,
): SessionStripTools | null {
  if (mode === 'workshop') return { timer: true, vote: true, poll: true };
  if (mode === 'plan') return planVoting ? { timer: true, vote: true, poll: false } : null;
  if (mode === 'pages') return { timer: false, vote: true, poll: true, runningOnly: true };
  return null;
}

// Whether this strip offers its idle tools, to start one: an editor's, outside a running-only strip. The one
// rule both the strip's buttons and its popovers' closing read, so they never disagree about what is there.
export function stripCanStart(tools: SessionStripTools, readOnly: boolean): boolean {
  return !readOnly && !tools.runningOnly;
}

// Has the button under an open strip popover gone? Then the popover closes rather than float with nothing
// under it: the mode offers no strip or not that tool (a mode switch), or the strip shows only running tools
// (a view-role visitor's, or Pages mode's for everyone) and that tool's activity has ended. `running.poll`
// is a poll whose results are ours to see, which is when its button shows.
export function stripSegmentGone({
  segment,
  tools,
  readOnly,
  running,
}: {
  segment: SessionSegment | null;
  /** The strip's tools, or null when it has none (or no session to run them). */
  tools: SessionStripTools | null;
  readOnly: boolean;
  running: { timer: boolean; vote: boolean; poll: boolean };
}): boolean {
  if (segment === null) return false;
  if (!tools) return true;
  if (segment === 'session-poll' && !tools.poll) return true;
  if (segment === 'session-timer' && !tools.timer) return true;
  if (stripCanStart(tools, readOnly)) return false;
  if (segment === 'session-timer') return !running.timer;
  if (segment === 'session-vote') return !running.vote;
  return !running.poll;
}

type Toggle = (button: HTMLElement) => void;

const ICON_SIZE = 18;
const PRESSED = 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';

export function SessionClusterStrip({
  timer,
  voteRunning,
  voteDotsLeft = null,
  voteReviewing = false,
  voteButtonRef,
  pollRunning,
  canStart,
  offersTimer = true,
  offersPoll = true,
  open,
  onToggle,
}: {
  timer: TabTimer | null;
  voteRunning: boolean;
  // Your dots left while casting is open and you can cast; null otherwise.
  voteDotsLeft?: number | null;
  // The results walkthrough is running.
  voteReviewing?: boolean;
  // The Vote button, so the walkthrough can open its popover over it.
  voteButtonRef?: React.Ref<HTMLButtonElement>;
  // A poll is running and its results are ours to see (docs/specs/012-collaboration/live-poll.md).
  pollRunning: boolean;
  // An editor: the idle tools are offered too, to start one.
  canStart: boolean;
  // The mode has a Timer button (not in Pages).
  offersTimer?: boolean;
  // The mode has a Poll button (not in Plan).
  offersPoll?: boolean;
  // Which of the strip's popovers is open, if any.
  open: SessionSegment | null;
  onToggle: (segment: SessionSegment, button: HTMLElement) => void;
}) {
  const showTimer = offersTimer && (canStart || !!timer);
  const showVote = canStart || voteRunning;
  const showPoll = offersPoll && (canStart || pollRunning);
  if (!showTimer && !showVote && !showPoll) return null;
  return (
    <ClusterStrip dataTourId="session-tools">
      {showTimer ? (
        timer ? (
          <TimerClockSegment
            timer={timer}
            open={open === 'session-timer'}
            onToggle={(b) => onToggle('session-timer', b)}
          />
        ) : (
          <ClusterPopoverSegment
            label="Open Timer"
            name="Timer"
            hoverTitle="Timer"
            hoverDescription="Start a countdown or a stopwatch everyone on this tab can see."
            icon={<TimerMenuIcon size={ICON_SIZE} />}
            popoverOpen={open === 'session-timer'}
            onTogglePopover={(b) => onToggle('session-timer', b)}
          />
        )
      ) : null}
      {showVote ? (
        <ClusterPopoverSegment
          divided={showTimer}
          label={
            voteDotsLeft !== null
              ? `Open Vote (${voteDotsLeft} ${voteDotsLeft === 1 ? 'dot' : 'dots'} left)`
              : voteRunning
                ? 'Open Vote'
                : 'Start a Vote'
          }
          name="Vote"
          hoverTitle="Vote"
          hoverDescription={
            voteRunning
              ? 'The vote on this tab: who has voted, then the results.'
              : 'Run a dot vote on this tab.'
          }
          icon={
            voteDotsLeft !== null ? (
              <CountBadge count={voteDotsLeft} icon={<VoteMenuIcon size={ICON_SIZE} />} />
            ) : (
              <LiveBadge
                live={voteRunning}
                tone={voteReviewing ? 'amber' : 'emerald'}
                icon={<VoteMenuIcon size={ICON_SIZE} />}
              />
            )
          }
          popoverOpen={open === 'session-vote'}
          onTogglePopover={(b) => onToggle('session-vote', b)}
          {...(voteButtonRef ? { buttonRef: voteButtonRef } : {})}
        />
      ) : null}
      {showPoll ? (
        <ClusterPopoverSegment
          divided={showTimer || showVote}
          label={pollRunning ? 'Open Poll' : 'Start a Poll'}
          name="Poll"
          hoverTitle="Poll"
          hoverDescription={
            pollRunning ? 'The answers to the poll running now.' : 'Ask everyone here a question.'
          }
          icon={<LiveBadge live={pollRunning} icon={<PollMenuIcon size={ICON_SIZE} />} />}
          popoverOpen={open === 'session-poll'}
          onTogglePopover={(b) => onToggle('session-poll', b)}
        />
      ) : null}
    </ClusterStrip>
  );
}

// A running tool's glyph carries a small live dot, so the strip says what is on at a glance: green
// while it runs, amber while a vote's results are walked through (the canvas rings are amber too).
function LiveBadge({
  live,
  icon,
  tone = 'emerald',
}: {
  live: boolean;
  icon: React.ReactNode;
  tone?: 'emerald' | 'amber';
}) {
  if (!live) return icon;
  return (
    <span className="relative flex">
      {icon}
      <span
        aria-hidden
        className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
          tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'
        }`}
      />
    </span>
  );
}

// Your dots left on the Vote glyph while casting is open: the one number each participant needs.
function CountBadge({ count, icon }: { count: number; icon: React.ReactNode }) {
  return (
    <span className="relative flex">
      {icon}
      <span
        aria-hidden
        className={`absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-slate-900 ${SOLID_BRAND_DARK}`}
      >
        <span className="text-optical-centre">{count}</span>
      </span>
    </span>
  );
}

// The Timer while one runs: the glyph and the live clock, the countdown's drain behind them, and a
// pulse once a countdown reaches 0:00. Ticks only while running (useNow), so a paused timer costs
// nothing.
function TimerClockSegment({
  timer,
  open,
  onToggle,
}: {
  timer: TabTimer;
  open: boolean;
  onToggle: Toggle;
}) {
  const now = useNow(timer.running);
  const done = timerDone(timer, now);
  const clock = formatTimerClock(timerDisplayMs(timer, now));
  const kind = timer.mode === 'countdown' ? 'Timer' : 'Stopwatch';
  const button = (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onToggle(e.currentTarget)}
      aria-label={`${kind} ${clock}`}
      aria-expanded={open}
      style={open ? undefined : timerFillStyle(timer, now)}
      className={`flex h-11 items-center gap-1.5 px-3 transition ${
        open
          ? PRESSED
          : done
            ? 'animate-pulse text-rose-700 dark:text-rose-300'
            : CLUSTER_CONTROL_REST
      }`}
    >
      <TimerMenuIcon size={16} />
      <span className="select-none text-sm font-semibold tabular-nums">{clock}</span>
    </button>
  );
  // No hover card while open: it would sit over the panel it names. Disabled, not unwrapped, so the button keeps its focus as the panel opens.
  return (
    <HoverCard
      title={kind}
      description="Open the timer: add time, pause, reset or end it."
      disabled={open}
    >
      {button}
    </HoverCard>
  );
}
