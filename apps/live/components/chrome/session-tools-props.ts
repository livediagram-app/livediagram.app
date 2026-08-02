import type { Layer, TabTimer, TabVote, TimerMode, VoteSetup } from '@livediagram/diagram';
import type { LivePoll, PollStyle } from '@livediagram/api-schema';

// The session-tools bundle (spec/39, spec/88, spec/96): the running timer, the
// dot vote, the live poll, and every verb that drives them.
//
// Three chrome surfaces offer the same Session category — the tab bar's
// ellipsis menu, the tab context menu, and the standalone ellipsis button —
// and each had declared all sixteen props by hand. None of the three reads
// them; they thread the bundle down to the same SessionToolsSection, so the
// three lists could only ever be identical, and were.
//
// The one asymmetry worth keeping in view: the timer and the vote are Tab
// FIELDS, so they persist with the diagram, while the poll is ephemeral room
// state and never becomes one. That is why the poll arrives as three separate
// props rather than a `poll` slot on the tab beside the other two.
export type SessionToolsProps = {
  timer: TabTimer | null;
  vote: TabVote | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number, setup?: VoteSetup) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  livePoll: LivePoll | null;
  pollConnected: boolean;
  onStartPoll: (draft: { question: string; style: PollStyle; options: string[] }) => void;
  // The tab's layers + the active one, for the vote's layer scope (spec/96).
  voteLayers: Layer[];
  activeLayerId: string;
};
