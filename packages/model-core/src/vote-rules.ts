// The dot vote's casting rules (docs/specs/012-collaboration/session-tools.md in livediagram and liveplanner), over the
// fields of a vote they read. Each product's `TabVote` carries these and more, so its session module re-exports these
// rather than keeping a copy, and the shared vote overlay (@liveworkspace/workbench) reads the same rules as the cast
// handler.

// The fields of a product's `TabVote` the rules read.
export type VoteRulesVote = {
  // Casting open.
  active: boolean;
  // "Show results" pressed.
  revealed: boolean;
  // How many dots each participant may place across the tab.
  votesPerPerson: number;
  // vote key -> the participant ids that placed a dot there, one entry per dot.
  votes: Record<string, readonly string[]>;
  // Withhold other participants' dots until the results are revealed. Absent = off.
  hideCounts?: boolean;
  // At most one of a participant's dots per vote key. Absent = stack freely.
  onePerElement?: boolean;
  // Only elements with text take dots. Absent = off.
  onlyWithText?: boolean;
};

// Should other people's dots be withheld right now? Until the results are
// REVEALED, which spans both the open-casting and the ended-but-unrevealed
// phases: "Show results" is the existing gate this switch defers to.
export function voteHidesTallies(vote: VoteRulesVote | null | undefined): boolean {
  return !!vote && !vote.revealed && vote.hideCounts === true;
}

// How many dots this participant has placed across the tab.
export function votesSpentBy(vote: VoteRulesVote, participantId: string): number {
  let n = 0;
  for (const ids of Object.values(vote.votes)) {
    for (const id of ids) if (id === participantId) n++;
  }
  return n;
}

// Can this participant place one more dot on this vote key? Out of budget
// says no everywhere; a one-per-element vote also says no where they have
// already placed one, and a text-only vote where the element's text is blank
// (`hasText`, the caller's `elementHasText`: a blank element is only still
// votable because it holds dots, which can come off but not grow). The single
// rule the cast handler, the vote keys and the canvas stepper all read, so the
// plus can't offer a dot the handler refuses.
export function canCastVote(
  vote: VoteRulesVote,
  participantId: string,
  elementId: string,
  hasText = true,
): boolean {
  if (!vote.active) return false;
  if (vote.onlyWithText && !hasText) return false;
  if (votesSpentBy(vote, participantId) >= vote.votesPerPerson) return false;
  if (vote.onePerElement && (vote.votes[elementId] ?? []).includes(participantId)) return false;
  return true;
}
