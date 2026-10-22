'use client';

// A tab's session vote as a board's cards see it (docs/specs/012-collaboration/session-tools.md "Voting on Plan
// cards"): the vote, who is casting, the largest count (the winner ring), the tab's layers (a layer-scoped vote),
// the results walkthrough's focus and the cast and retract actions. The canvas provides it while the tab has a
// vote; a board's cards carry the vote's stepper from it, keyed by their card (itemVoteKey). Kept apart from
// PlanContext, whose identity is held still so boards re-render only when Plan state changes: a dot changes this.
import { createContext, useContext } from 'react';
import type { Layer, TabVote } from '@livediagram/document';

export type CardVote = {
  vote: TabVote;
  selfId: string | null;
  voteMax: number;
  layers: Layer[] | undefined;
  reviewActive: boolean;
  // The vote key the walkthrough is on, if any.
  focusKey: string | null;
  onCast?: ((key: string) => void) | undefined;
  onRetract?: ((key: string) => void) | undefined;
};

const CardVoteContext = createContext<CardVote | null>(null);

export const CardVoteProvider = CardVoteContext.Provider;

// The tab's vote for its cards, or null when none is running or shown.
export function useCardVote(): CardVote | null {
  return useContext(CardVoteContext);
}
