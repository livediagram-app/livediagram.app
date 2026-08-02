// Per-tab live session tools (spec/39): a facilitator-run TIMER and
// dot-VOTING, both controlled from the tab settings and synced to every
// participant. They live as optional `Tab` fields (`timer`, `vote`) so
// they ride the existing tab-content sync + persistence + late-joiner
// replay with no realtime/api changes — and the room already gates
// mutations to edit-role, so control + casting is edit-role (viewers
// watch). Everything here is PURE (the caller passes `now`) so the
// countdown / stopwatch and the vote tallies are unit-testable and the
// clients tick locally off an absolute anchor rather than over the wire.

import type { Element, Layer } from './index';
import { resolveLayerId, tabLayers } from './layers';

// --- Timer -----------------------------------------------------------------

export type TimerMode = 'countdown' | 'stopwatch';

export type TabTimer = {
  mode: TimerMode;
  running: boolean;
  // Countdown: the configured length, so Reset returns to it.
  durationMs?: number;
  // Wall-clock anchor while running: for a countdown it's the instant the
  // timer hits zero (`endsAt`); for a stopwatch it's the instant the
  // current run began. null/undefined while paused.
  anchorAt?: number;
  // The frozen value captured at the last pause: remaining ms for a
  // countdown, elapsed ms for a stopwatch. Undefined before the first run.
  frozenMs?: number;
};

// The ms a timer should DISPLAY at `now`: remaining for a countdown
// (floored at 0), elapsed for a stopwatch. Pure — pass Date.now() in.
export function timerDisplayMs(timer: TabTimer, now: number): number {
  if (timer.mode === 'countdown') {
    if (timer.running && timer.anchorAt !== undefined) return Math.max(0, timer.anchorAt - now);
    return Math.max(0, timer.frozenMs ?? timer.durationMs ?? 0);
  }
  // stopwatch: elapsed accumulates while running from the anchor.
  if (timer.running && timer.anchorAt !== undefined) return Math.max(0, now - timer.anchorAt);
  return Math.max(0, timer.frozenMs ?? 0);
}

// A countdown that has reached zero (only meaningful for countdown mode).
export function timerDone(timer: TabTimer, now: number): boolean {
  return timer.mode === 'countdown' && timerDisplayMs(timer, now) <= 0;
}

// m:ss readout for a timer's display ms — the one formatting rule the
// floating TimerWidget (live ticking clock) and the Session tools
// section (static snapshot) share; each used to carry its own copy.
export function formatTimerClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// --- Voting (dot-voting on elements) ---------------------------------------

export type TabVote = {
  // Casting open. Ending a vote sets this false; the tallies remain.
  active: boolean;
  // Winner-highlight shown ("Show results"). Counts are live regardless.
  revealed: boolean;
  // How many dots each participant may place across the tab.
  votesPerPerson: number;
  // elementId -> the participant ids that placed a dot there. A participant
  // id repeats once per dot, so stacking N dots on one element is N entries.
  votes: Record<string, string[]>;
  // --- Vote privacy (spec/39) ----------------------------------------------
  // Both are set once at startVote and never change mid-vote: to vote under
  // different rules you end the vote and start another. Optional so a vote
  // persisted before privacy shipped decodes unchanged (absent = off), and
  // read through the two helpers below rather than tested directly, so the
  // "only while it matters" phase check lives in one place.
  //
  // Suppress peer cursors + laser trails while casting is open, so nobody
  // can watch the room converge on a favourite before the vote closes.
  hideCursors?: boolean;
  // Withhold OTHER participants' dots until the results are revealed, so a
  // climbing tally can't snowball. Your own dots always stay visible.
  hideCounts?: boolean;
  // --- Facilitation (spec/39) --------------------------------------------
  // The participant id that started this vote. Only they can end / reveal /
  // clear it and drive the results walkthrough — a vote is one person's to
  // run, and an accidental End by a participant mid-round can't be undone
  // (starting again loses every dot). Optional for back-compat: a vote
  // persisted before this shipped has no host, and `isVoteHost` treats that
  // as "anyone may drive" so an in-flight legacy vote can still be ended.
  startedBy?: string;
  // Restrict voting to ONE layer (spec/96). Absent = every layer is
  // votable, which is both the pre-layer-scoping behaviour and what a
  // single-layer tab always gets. Set once at start, like the privacy
  // switches: changing it means ending the vote and starting another.
  voteLayerId?: string;
  // Which rank the results walkthrough is currently on. SHARED, not local:
  // the host steps the room through the picks together and everyone else
  // follows. Absent until the host reveals results.
  reviewIndex?: number;
};

// May this participant drive the vote (end / reveal / clear it, and move
// the results focus)? A vote written before `startedBy` existed has no
// host, so it stays drivable by anyone rather than becoming unendable.
export function isVoteHost(vote: TabVote | null | undefined, selfId: string): boolean {
  if (!vote) return false;
  if (vote.startedBy === undefined) return true;
  return vote.startedBy === selfId;
}

// The privacy choices a facilitator makes BEFORE starting a vote, passed
// to `startVote` and baked into the resulting `TabVote`. Separate from the
// optional flags on `TabVote` itself (which are optional for back-compat)
// because a fresh vote always states both answers explicitly.
export type VotePrivacy = {
  hideCursors: boolean;
  hideCounts: boolean;
};

// Everything the facilitator chooses BEFORE starting a vote: the privacy
// switches plus the optional layer scope (spec/96). One object because
// they share a lifecycle — all of it is baked into the TabVote at start
// and none of it can change while the vote runs.
export type VoteSetup = VotePrivacy & {
  // Restrict casting to this layer. Undefined = every layer, which is
  // what a single-layer tab always gets (the picker doesn't even show).
  layerId?: string;
};

// Should peer cursors / laser trails be withheld right now? Only while
// casting is OPEN: ending the vote restores them, ahead of the reveal
// (spec/39 — "hidden" means exactly "while the vote is open").
export function voteHidesCursors(vote: TabVote | null | undefined): boolean {
  return !!vote && vote.active && vote.hideCursors === true;
}

// Should other people's dots be withheld right now? Until the results are
// REVEALED, which spans both the open-casting and the ended-but-unrevealed
// phases — "Show results" is the existing gate this switch defers to.
export function voteHidesTallies(vote: TabVote | null | undefined): boolean {
  return !!vote && !vote.revealed && vote.hideCounts === true;
}

// Which element kinds a dot-vote can land on (spec/39): stickies, images,
// and shapes — but NOT a `frame` (it's a section backdrop, not content),
// and not text / freehand / table / arrow / annotation.
// Interactive Behaviour elements (spec/103, /104, /105, /106, /107): a mode
// button, portal, session button, reveal, picker or reaction pad DOES
// something when you
// press it. Voting turns a press into a dot, so a votable behaviour element
// would have two conflicting meanings for the same tap — and the one the user
// gets would depend on whether a vote happens to be running. They are
// controls, not candidates.
const NON_VOTABLE_SHAPES = new Set([
  // A section backdrop, not content.
  'frame',
  'mode-button',
  'portal',
  'session-button',
  'reveal',
  'picker',
  'reaction-pad',
  // A comment pin (spec/136) IS a remark; a dot on one means nothing.
  'comment-pin',
]);

export function isVotable(element: Element): boolean {
  if (element.type === 'sticky' || element.type === 'image') return true;
  return element.type === 'shape' && !NON_VOTABLE_SHAPES.has(element.shape);
}

// Can this element take a dot in THIS vote? The kind rule above, plus
// the vote's optional layer scope (spec/96).
//
// Layer resolution goes through `resolveLayerId` rather than comparing
// `element.layerId` directly: elements authored before spec/74 carry no
// layerId at all and belong to the base layer, so a raw comparison would
// make every one of them unvotable the moment a scope was set.
export function isVotableInVote(
  element: Element,
  vote: TabVote | null | undefined,
  layers: Layer[] | undefined,
): boolean {
  if (!isVotable(element)) return false;
  const scope = vote?.voteLayerId;
  if (!scope) return true;
  return resolveLayerId(element.layerId, tabLayers(layers)) === scope;
}

// How many dots a given participant has spent across the whole tab.
export function votesSpentBy(vote: TabVote, participantId: string): number {
  let n = 0;
  for (const ids of Object.values(vote.votes)) {
    for (const id of ids) if (id === participantId) n++;
  }
  return n;
}

// Total dot count per element id (collapses the per-participant arrays).
export function voteTotals(vote: TabVote): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [elementId, ids] of Object.entries(vote.votes)) {
    if (ids.length > 0) totals[elementId] = ids.length;
  }
  return totals;
}

// The element id(s) with the highest dot count (empty when no votes cast).
// Ties return every joint-winner so the UI can highlight them all.
export function voteWinners(vote: TabVote): string[] {
  const totals = voteTotals(vote);
  let max = 0;
  for (const n of Object.values(totals)) if (n > max) max = n;
  if (max === 0) return [];
  return Object.keys(totals).filter((id) => totals[id] === max);
}
