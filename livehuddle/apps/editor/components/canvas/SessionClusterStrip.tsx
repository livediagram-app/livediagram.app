'use client';

import { formatTimerClock, timerDone, timerDisplayMs, type TabTimer } from '@livehuddle/document';
import { HoverCard } from '@livehuddle/ui';
import { TimerMenuIcon } from '@/components/palette/context-menu-icons';
import { timerFillStyle } from '@/components/chrome/timer-pill';
import { useNow } from '@liveworkspace/workbench/hooks/ui/useNow';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';

// The Session strip in the bottom-right cluster (docs/specs/012-collaboration/session-tools.md "The Session
// strip"): the Timer, left of Layers. It opens above it, set-up while idle and the live tool while it runs. An
// editor always has the Timer; a view-role visitor, who cannot start anything, gets it only while one runs. It
// shows its clock while a timer runs, so the time reads without opening anything. The Vote left livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "The Vote").

export type SessionSegment = 'session-timer';

// Which tools a mode's strip offers (docs/specs/012-collaboration/session-tools.md "The Session strip"): the Timer
// on every meeting board (docs/specs/012-collaboration/workshop-mode.md "The Session strip"). The live poll left
// with the Collaborate tools (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"). None for any
// other mode, even while a tool runs.
export type SessionStripTools = {
  timer: boolean;
};

export function sessionStripTools(mode: string | undefined): SessionStripTools | null {
  if (mode === 'workshop') return { timer: true };
  return null;
}

// An embed (docs/specs/013-workspace/embeds.md) has no Session strip: its visitors read the document and
// cannot run or join a session there, so the Timer button would only open nothing. The
// editor host hands the canvas chrome its session tools through this, so an embed gets none.
export function sessionToolsForSurface<T>(tools: T, embedMode: boolean): T | undefined {
  return embedMode ? undefined : tools;
}

// Whether this strip offers its idle tools, to start one: an editor's. The one rule both the strip's buttons
// and its popovers' closing read, so they never disagree about what is there.
export function stripCanStart(readOnly: boolean): boolean {
  return !readOnly;
}

// Has the button under an open strip popover gone? Then the popover closes rather than float with nothing
// under it: the mode offers no strip or not that tool (a mode switch), or the strip shows only running tools
// (a view-role visitor's) and that tool's activity has ended.
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
  running: { timer: boolean };
}): boolean {
  if (segment === null) return false;
  if (!tools) return true;
  if (!tools.timer) return true;
  if (stripCanStart(readOnly)) return false;
  return !running.timer;
}

type Toggle = (button: HTMLElement) => void;

const ICON_SIZE = 18;
const PRESSED = 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';

export function SessionClusterStrip({
  timer,
  canStart,
  offersTimer = true,
  open,
  onToggle,
}: {
  timer: TabTimer | null;
  // An editor: the idle tools are offered too, to start one.
  canStart: boolean;
  // The mode has a Timer button.
  offersTimer?: boolean;
  // Which of the strip's popovers is open, if any.
  open: SessionSegment | null;
  onToggle: (segment: SessionSegment, button: HTMLElement) => void;
}) {
  const showTimer = offersTimer && (canStart || !!timer);
  if (!showTimer) return null;
  return (
    <ClusterStrip dataTourId="session-tools">
      {timer ? (
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
      )}
    </ClusterStrip>
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
