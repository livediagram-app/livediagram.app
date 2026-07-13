import { useEffect, useMemo, useRef, useState } from 'react';
import { isBoxed, isVotable, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// Vote-results review (spec/39). Once a vote's results are revealed, the
// facilitator walks the voted elements ONE AT A TIME, most dots first: the
// current pick pulses an amber focus highlight and the viewport centres on
// it; Previous / Next in the vote banner cycle through the order, and Done
// (on the last pick) ends the walkthrough AND clears the vote session (the
// review is the results' final act, so no separate Clear trip through the
// tab menu). The review index is LOCAL: every participant reviews at their
// own pace; only the reveal itself (and the Done clear) is shared state.

export type VoteReview = {
  // The element under review, its 0-based position, the total number of
  // voted elements, and its dot count: everything the banner shows.
  focusId: string;
  index: number;
  total: number;
  votes: number;
};

export function useVoteReview({
  activeTab,
  scrollIntoView,
  clearVote,
}: {
  activeTab: Tab;
  // Removes the tab's vote session (useTabSession). Done calls it so
  // finishing the walkthrough also clears the vote for everyone.
  clearVote: () => void;
  scrollIntoView: (x: number, y: number, w: number, h: number, opts?: { center?: boolean }) => void;
}) {
  const vote = activeTab.vote ?? null;

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

  // null = not reviewing (never revealed, or Done pressed). Entered on the
  // reveal EDGE so pressing Done doesn't immediately re-enter, and left
  // whenever the vote unreveals / clears (a fresh vote = a fresh review).
  const [index, setIndex] = useState<number | null>(null);
  const revealedRef = useRef(false);
  useEffect(() => {
    const revealed = !!vote?.revealed;
    if (revealed && !revealedRef.current) setIndex(0);
    if (!revealed) setIndex(null);
    revealedRef.current = revealed;
  }, [vote?.revealed]);

  const focus = index !== null ? (results[index] ?? null) : null;

  // Centre the focused pick on screen whenever the WALK moves (not on
  // unrelated element churn, hence the focused-id dep). Always centres
  // (not just an edge-pull pan) so every pick lands mid-screen.
  const focusId = focus?.id ?? null;
  useEffect(() => {
    if (!focusId) return;
    const el = activeTab.elements.find((e) => e.id === focusId);
    if (el && isBoxed(el)) scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    // The pan follows the focus, never geometry churn mid-review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const clampSet = (i: number) => setIndex(Math.max(0, Math.min(results.length - 1, i)));

  return {
    voteReview:
      focus && index !== null
        ? { focusId: focus.id, index, total: results.length, votes: focus.votes }
        : null,
    nextVoteResult: () => {
      if (index !== null) clampSet(index + 1);
    },
    prevVoteResult: () => {
      if (index !== null) clampSet(index - 1);
    },
    doneVoteReview: () => {
      setIndex(null);
      clearVote();
      track('Tab', 'Ended', 'VoteReview');
    },
  };
}
