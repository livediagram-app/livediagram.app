import type { TabTimer, TimerMode } from '@livehuddle/document';

// The session-tools bundle (docs/specs/012-collaboration/session-tools.md): the running timer and every verb that
// drives it. The timer is a Tab field, so it persists with the document.
//
// One bundle, read once (useSessionTools) for the bottom bar's Session strip and handed to its
// popovers' panes (docs/specs/012-collaboration/session-tools.md "The Session strip").
export type SessionToolsProps = {
  // Who is running the session, when it is not you (docs/specs/012-collaboration/facilitator.md). The set-up
  // popovers show the name and disables every control in one place, which is the
  // whole reason these verbs already travel as one bundle.
  facilitatedBy?: string | null;
  // We hold the facilitator baton (docs/specs/012-collaboration/facilitator.md).
  facilitating?: boolean;
  timer: TabTimer | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  // Add time to a running (or paused) countdown without restarting it.
  onExtendTimer: (deltaMs: number) => void;
};
