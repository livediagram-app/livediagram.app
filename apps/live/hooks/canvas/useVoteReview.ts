import { useEffect, useMemo, useRef } from 'react';
import { isBoxed, isVotable, isVoteHost, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// Vote-results review (spec/39). Once a vote's results are revealed, the
// HOST walks the voted elements one at a time, most dots first: the
// current pick pulses an amber focus highlight and every participant's
// viewport centres on it. Previous / Next in the vote banner and the rows
// of the Vote panel move the walk; Done (on the last pick) ends it AND
// clears the vote session, so the review is the results' final act.
//
// The review index is SHARED (`vote.reviewIndex`), not per-participant:
// the room reviews the picks together, and only the host can move the
// focus. It used to be local — every participant walked at their own pace
// — but that meant a facilitator saying "look at this one" had no way to
// actually put the room on it.

export type VoteReview = {
  // The element under review, its 0-based position, the total number of
  // voted elements, and its dot count: everything the banner shows.
  focusId: string;
  index: number;
  total: number;
  votes: number;
  // Whether THIS participant may move the walk. Non-hosts follow along.
  canControl: boolean;
};

export function useVoteReview({
  activeTab,
  selfId,
  scrollIntoView,
  clearVote,
  setVoteReviewIndex,
}: {
  activeTab: Tab;
  // The local participant id, matched against the vote's `startedBy`.
  selfId: string;
  // Removes the tab's vote session (useTabSession). Done calls it so
  // finishing the walkthrough also clears the vote for everyone.
  clearVote: () => void;
  // Writes the SHARED walk position onto the tab. Host-gated inside
  // useTabSession, so a non-host calling it is a no-op.
  setVoteReviewIndex: (index: number) => void;
  scrollIntoView: (x: number, y: number, w: number, h: number, opts?: { center?: boolean }) => void;
}) {
  const vote = activeTab.vote ?? null;
  const canControl = isVoteHost(vote, selfId);

  // The review order: every votable element holding at least one dot, most
  // dots first; ties keep the tab's element order so the walk is stable.
  const results = useMemo(() => {
    if (!vote?.revealed) return [];
    const counts = new Map(Object.entries(vote.votes).map(([id, v]) => [id, v.length]));
    return activeTab.elements
      .filter((el) => isBoxed(el) && isVotable(el) && (counts.get(el.id) ?? 0) > 0)
      .map((el) => ({ id: el.id, votes: counts.get(el.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [vote, activeTab.elements]);

  // Not reviewing until the host reveals. `reviewIndex` is seated to 0 by
  // revealVote, so an unrevealed (or freshly cleared) vote has none and
  // every client agrees there's no walk in progress.
  const index = vote?.revealed
    ? Math.max(0, Math.min(results.length - 1, vote.reviewIndex ?? 0))
    : null;
  const focus = index !== null ? (results[index] ?? null) : null;

  // Centre the focused pick on screen whenever the WALK moves (not on
  // unrelated element churn, hence the focused-id dep). Always centres
  // (not just an edge-pull pan) so every pick lands mid-screen — for
  // followers as much as the host, which is the point of sharing it.
  const focusId = focus?.id ?? null;
  const lastCentred = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || lastCentred.current === focusId) return;
    lastCentred.current = focusId;
    const el = activeTab.elements.find((e) => e.id === focusId);
    if (el && isBoxed(el)) scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    // The pan follows the focus, never geometry churn mid-review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const clampSet = (i: number) => setVoteReviewIndex(Math.max(0, Math.min(results.length - 1, i)));

  return {
    voteReview:
      focus && index !== null
        ? { focusId: focus.id, index, total: results.length, votes: focus.votes, canControl }
        : null,
    // The ranked order itself, for the Vote panel's results list — the same
    // array the walkthrough steps through, so the list and the Previous /
    // Next buttons can never disagree about the ranking.
    voteResults: results,
    // Jump straight to a rank (the panel's rows). No-op for non-hosts.
    jumpToVoteResult: (i: number) => clampSet(i),
    nextVoteResult: () => {
      if (index !== null) clampSet(index + 1);
    },
    prevVoteResult: () => {
      if (index !== null) clampSet(index - 1);
    },
    doneVoteReview: () => {
      // Clearing the vote drops `reviewIndex` with it, so every client
      // leaves the walk together — no separate "stop reviewing" state.
      clearVote();
      track('Tab', 'Ended', 'VoteReview');
    },
  };
}
