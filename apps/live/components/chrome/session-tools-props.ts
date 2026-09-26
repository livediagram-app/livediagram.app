import type { Layer, TabTimer, TabVote, TimerMode, VoteSetup } from '@livediagram/diagram';
import type { LivePoll, PollStyle } from '@livediagram/api-schema';
import type { PollCandidate } from '@/lib/poll-collaborators';

// The session-tools bundle (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/live-poll.md, docs/specs/012-collaboration/vote-layer-scope.md): the running timer, the
// dot vote, the live poll, and every verb that drives them.
//
// Three chrome surfaces offer the same Session category — the tab bar's
// ellipsis menu, the tab context menu, and the standalone ellipsis button —
// and each had declared all sixteen props by hand. None of the three reads
// them; they thread the bundle down to the same SessionStudio, so the
// three lists could only ever be identical, and were.
//
// The one asymmetry worth keeping in view: the timer and the vote are Tab
// FIELDS, so they persist with the diagram, while the poll is ephemeral room
// state and never becomes one. That is why the poll arrives as three separate
// props rather than a `poll` slot on the tab beside the other two.
export type SessionToolsProps = {
  // Who is running the session, when it is not you (docs/specs/012-collaboration/facilitator.md). The Studio
  // shows the name and disables every control in one place, which is the
  // whole reason these sixteen verbs already travel as one bundle.
  facilitatedBy?: string | null;
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
  livePoll: LivePoll | null;
  // Shared or on a team, so a poll reaches other people. False doesn't stop
  // a poll (it runs for just you); the composer only notes it.
  pollHasAudience: boolean;
  onStartPoll: (draft: { question: string; style: PollStyle; options: string[] }) => void;
  // Everyone currently in the diagram, for the `collaborators` poll style
  // (docs/specs/012-collaboration/live-poll.md). The composer needs it to PREVIEW the ballot it is about to
  // freeze; the freeze itself happens in `startPoll`, reading the roster again
  // at the instant the poll starts, so what is sent is never staler than the
  // press. Raw candidates rather than finished option strings: turning them
  // into a ballot (de-duplicating, numbering repeats, capping) is one pure
  // function both sides call, not a list one side prepares for the other.
  pollCollaborators: readonly PollCandidate[];
  // The tab's layers + the active one, for the vote's layer scope (docs/specs/012-collaboration/vote-layer-scope.md).
  voteLayers: Layer[];
  activeLayerId: string;
};
