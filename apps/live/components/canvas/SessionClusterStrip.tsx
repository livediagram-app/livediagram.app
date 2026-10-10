'use client';

import { formatTimerClock, timerDone, timerDisplayMs, type TabTimer } from '@livediagram/document';
import { HoverCard } from '@livediagram/ui';
import { PollMenuIcon, TimerMenuIcon, VoteMenuIcon } from '@/components/palette/context-menu-icons';
import { timerFillStyle } from '@/components/chrome/timer-pill';
import { useNow } from '@/hooks/ui/useNow';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';

// The Session strip in the bottom-right cluster (docs/specs/012-collaboration/session-tools.md "The Session
// strip"): Timer, Vote and Poll in one strip left of Layers, as Plan mode's buttons share one. Each
// opens its tool above it, set-up while idle and the live tool while it runs. An editor always has
// the three; a view-role visitor, who cannot start anything, gets only the ones running. The Timer
// shows its clock while a timer runs, so the time reads without opening anything.

export type SessionSegment = 'session-timer' | 'session-vote' | 'session-poll';

type Toggle = (button: HTMLElement) => void;

const ICON_SIZE = 18;
const PRESSED = 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';

export function SessionClusterStrip({
  timer,
  voteRunning,
  pollRunning,
  canStart,
  open,
  onToggle,
}: {
  timer: TabTimer | null;
  voteRunning: boolean;
  // A poll is running and its results are ours to see (docs/specs/012-collaboration/live-poll.md).
  pollRunning: boolean;
  // An editor: the idle tools are offered too, to start one.
  canStart: boolean;
  // Which of the strip's popovers is open, if any.
  open: SessionSegment | null;
  onToggle: (segment: SessionSegment, button: HTMLElement) => void;
}) {
  const showTimer = canStart || !!timer;
  const showVote = canStart || voteRunning;
  const showPoll = canStart || pollRunning;
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
          label={voteRunning ? 'Open Vote' : 'Start a Vote'}
          hoverTitle="Vote"
          hoverDescription={
            voteRunning
              ? 'The vote on this tab: who has voted, then the results.'
              : 'Run a dot vote on this tab.'
          }
          icon={<LiveBadge live={voteRunning} icon={<VoteMenuIcon size={ICON_SIZE} />} />}
          popoverOpen={open === 'session-vote'}
          onTogglePopover={(b) => onToggle('session-vote', b)}
        />
      ) : null}
      {showPoll ? (
        <ClusterPopoverSegment
          divided={showTimer || showVote}
          label={pollRunning ? 'Open Poll' : 'Start a Poll'}
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

// A running tool's glyph carries a small live dot, so the strip says what is on at a glance.
function LiveBadge({ live, icon }: { live: boolean; icon: React.ReactNode }) {
  if (!live) return icon;
  return (
    <span className="relative flex">
      {icon}
      <span
        aria-hidden
        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
      />
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
  // No hover card while open: it would sit over the panel it names.
  return open ? (
    button
  ) : (
    <HoverCard title={kind} description="Open the timer: add time, pause, reset or end it.">
      {button}
    </HoverCard>
  );
}
