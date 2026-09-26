// "Did anyone actually work together on this?" (docs/specs/017-telemetry/telemetry.md, Diagram·Used·Multiplayer).
//
// Counted by the diagram room, not the browsers. It used to be a client emit
// fired when a tab's presence list first held a peer, which meant EVERY
// participant reported the same session: two people counted 2, a five-person
// retro counted 5, while the card said "once per session". The room is the
// one party that sees every participant at once, so it decides once.
//
// A SESSION is a run of continuous occupancy that at some point held two
// people who had said hello. It starts the first time a hello'd roster
// reaches two, and it ends only when the room is empty again: someone who
// leaves and comes back while a colleague is still in keeps the same session,
// so a flaky connection or a refresh never counts a second one.
//
// The "already counted" mark lives on each session's socket attachment
// rather than in a field or storage: the attachment is the only per-session
// state that survives hibernation, and the mark disappears on its own with
// the last socket, which is exactly when the session ends. No sweep, no stale
// flag if the room is torn down without a close event.

export type MultiplayerSession = {
  // Said hello, so it is on the roster peers see (unhello'd sockets are not).
  present: boolean;
  // Already part of a counted multiplayer session.
  multiplayer?: boolean;
};

export type MultiplayerDecision = {
  // True exactly once per session: the roster just reached two and nobody
  // connected was already in a counted session.
  report: boolean;
  // Indexes (into the input) of present sessions to stamp as counted, so a
  // later joiner, or a later frame, does not count the session again.
  mark: number[];
};

export function multiplayerDecision(sessions: readonly MultiplayerSession[]): MultiplayerDecision {
  const present = sessions.flatMap((s, i) => (s.present ? [i] : []));
  if (present.length < 2) return { report: false, mark: [] };
  const alreadyCounted = sessions.some((s) => s.multiplayer);
  return {
    report: !alreadyCounted,
    mark: present.filter((i) => !sessions[i]!.multiplayer),
  };
}
