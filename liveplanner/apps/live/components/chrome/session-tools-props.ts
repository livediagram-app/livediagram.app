import type { Layer, TabTimer, TabVote, TimerMode, VoteSetup } from '@liveplanner/document';

// The session-tools bundle (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/vote-layer-scope.md): the running timer, the
// dot vote, and every verb that drives them.
//
// One bundle, read once (useSessionTools) for the bottom bar's Session strip and handed to its
// popovers' panes (docs/specs/012-collaboration/session-tools.md "The Session strip"). Both tools are Tab
// FIELDS, so they persist with the document.
export type SessionToolsProps = {
  timer: TabTimer | null;
  vote: TabVote | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  // Add time to a running (or paused) countdown without restarting it.
  onExtendTimer: (deltaMs: number) => void;
  onStartVote: (votesPerPerson: number, setup?: VoteSetup) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  // The tab's layers + the active one, for the vote's layer scope (docs/specs/012-collaboration/vote-layer-scope.md).
  voteLayers: Layer[];
  activeLayerId: string;
};
