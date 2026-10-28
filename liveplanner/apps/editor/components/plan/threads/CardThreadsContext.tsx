'use client';

// What a card's comment threads read (docs/specs/026-plan/items.md "Comments"): the plan's threads and their writes,
// who is looking and what they may do. Its own context beside the Plan's
// (PlanContext.tsx), so a thread write re-renders the open card panel, never every card on a board: card faces read
// their comment count from the thread store alone (`ThreadCountsProvider`, hooks/plan/thread-store.ts).

import { createContext, useContext } from 'react';
import type { CardThreads } from '@/hooks/plan/useCardThreads';
import type { ThreadStore } from '@/hooks/plan/thread-store';

export type CardThreadsContextValue = {
  threads: CardThreads;
  projectId: string;
  projectName: string;
  // This person's owner id: the author id their own comments carry (Edit and Delete on them).
  selfId: string;
  // Their name and colour, for the avatar beside a composer.
  self: { name: string; color: string } | null;
  // Starting, replying, resolving and renaming: a Participant's and an Editor's (a Viewer reads).
  canComment: boolean;
  // Deleting anyone's comment or any thread: an Editor's.
  isEditor: boolean;
  ownerId: string;
  // Opens a card of this plan in the card panel.
  openCard: (itemId: string) => void;
  announce: (message: string) => void;
};

const CardThreadsContext = createContext<CardThreadsContextValue | undefined>(undefined);
export const CardThreadsProvider = CardThreadsContext.Provider;

export function useCardThreadsContext(): CardThreadsContextValue | undefined {
  return useContext(CardThreadsContext);
}

const ThreadCountsContext = createContext<ThreadStore | null>(null);
export const ThreadCountsProvider = ThreadCountsContext.Provider;

export function useThreadStore(): ThreadStore | null {
  return useContext(ThreadCountsContext);
}
