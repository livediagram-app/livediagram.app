'use client';

// The door to Publish Roadmap (docs/specs/026-plan/public-roadmap.md "Where it lives"): set by RoadmapHost for
// someone who may publish, on a plan with a Plan board; null otherwise, so the Tools row (roadmap-tools-item) reads one
// value and is left out without it. Beside it, the plan's published roadmaps by board, for the board's Roadmap pill
// ("On the board"): set for the same people, null for everyone else, so no one else's header reads or draws one.
import { createContext, useContext, useEffect } from 'react';
import type { PublishedRoadmap } from '@liveplanner/api-schema';

export type RoadmapDoor = { open: () => void };

export const RoadmapDoorContext = createContext<RoadmapDoor | null>(null);

export const useRoadmapDoor = () => useContext(RoadmapDoorContext);

export type RoadmapBoards = {
  // The published roadmaps by board id; null until the one read has answered (or when it failed).
  byBoard: ReadonlyMap<string, PublishedRoadmap> | null;
  // Asks for the one read; every call after the first does nothing.
  want: () => void;
  // Opens Publish Roadmap on this board.
  manage: (boardId: string) => void;
};

export const RoadmapBoardsContext = createContext<RoadmapBoards | null>(null);

/** The board's published roadmap, and how to manage it; null when it has none or this person may not publish. */
export function useRoadmapOnBoard(
  boardId: string | undefined,
): { roadmap: PublishedRoadmap; manage: () => void } | null {
  const boards = useContext(RoadmapBoardsContext);
  const want = boards?.want;
  useEffect(() => {
    if (boardId) want?.();
  }, [boardId, want]);
  const roadmap = boardId ? boards?.byBoard?.get(boardId) : undefined;
  if (!boards || !boardId || !roadmap) return null;
  return { roadmap, manage: () => boards.manage(boardId) };
}
