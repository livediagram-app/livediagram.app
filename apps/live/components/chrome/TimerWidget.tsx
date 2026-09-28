'use client';

import { timerDone, type TabTimer } from '@livediagram/diagram';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { TimerPillBody, timerFillStyle } from '@/components/chrome/timer-pill';
import { useNow } from '@/hooks/ui/useNow';

// Floating session-timer pill (docs/specs/012-collaboration/session-tools.md). Renders the active tab's
// countdown / stopwatch, ticking LOCALLY off the timer's absolute anchor
// (no per-second network traffic — all clients compute the same value).
// Facilitators (edit-role) get pause/resume + reset inline; viewers see a
// read-only clock. Start / duration / clear live in the Tab Settings.
export function TimerWidget({
  timer,
  readOnly,
  onPause,
  onResume,
  onReset,
  onClear,
}: {
  timer: TabTimer;
  readOnly: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  // Dismiss the timer entirely. Reset only returns it to its starting value,
  // so without this the pill could be stopped but never got off the canvas
  // except by going back into the tab menu that started it.
  onClear: () => void;
}) {
  // The clock advances ~4x a second while running. Paused timers are static, so nothing spins then.
  const now = useNow(timer.running);
  const done = timerDone(timer, now);

  return (
    <TopCenterBanner
      tone={done ? 'danger' : 'neutral'}
      className={'gap-2 py-1 pl-3 pr-1.5' + (done ? ' animate-pulse' : '')}
      // The drain, the clock and the controls all come from timer-pill, shared
      // with the Timer session element on the canvas (docs/specs/012-collaboration/session-button.md) so the two
      // views of one timer cannot drift apart.
      style={timerFillStyle(timer, now)}
    >
      <TimerPillBody
        timer={timer}
        now={now}
        readOnly={readOnly}
        onPause={onPause}
        onResume={onResume}
        onReset={onReset}
        onClear={onClear}
      />
    </TopCenterBanner>
  );
}
