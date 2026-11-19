'use client';

// Gives the editor its door to Publish Roadmap (RoadmapContext), the Tools row's, and draws the dialog while it is
// open (docs/specs/026-plan/public-roadmap.md "Where it lives"). The door is there only on a plan with a Plan board on
// any tab; the dialog picks the tab, starting on the one in view. The
// dialog's code loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose people
// never open it pays nothing for it. It also keeps the plan's published roadmaps by board for the boards' Roadmap
// pills (use-roadmaps-on-boards.ts, "On the board"), whose Roadmap Settings opens the dialog on that board.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';
import { track } from '@/lib/telemetry';
import {
  RoadmapBoardsContext,
  RoadmapDoorContext,
  type RoadmapBoards,
  type RoadmapDoor,
} from './RoadmapContext';
import { useRoadmapsOnBoards } from './use-roadmaps-on-boards';
import type { RoadmapScope } from './roadmap-gate';

const RoadmapDialog = dynamic(() => import('./RoadmapDialog').then((m) => m.RoadmapDialog), {
  ssr: false,
});

export function RoadmapHost({
  scope,
  hasBoards,
  activeTabId,
  itemTypes,
  children,
}: {
  // Null for anyone who may not publish (roadmapScopeFor).
  scope: RoadmapScope | null;
  // Whether any tab of the plan holds a Plan board.
  hasBoards: boolean;
  // The tab in view, where the dialog starts when it holds a board.
  activeTabId: string;
  // The plan's card types and their changes, where the dialog adds Votes to a published roadmap's types
  // (public-roadmap.md "The settings"); absent outside a plan's editor.
  itemTypes?: ItemTypesSlice | undefined;
  children: ReactNode;
}) {
  // Taken when the dialog opens, so switching tabs behind it does not move it; a board's pill names its board too.
  const [openOn, setOpenOn] = useState<{ tabId: string; boardId?: string } | null>(null);
  const { ownerId, projectId } = scope ?? {};
  const stable = useMemo<RoadmapScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId } : null),
    [ownerId, projectId],
  );
  const door = useMemo<RoadmapDoor | null>(
    () =>
      stable && hasBoards
        ? {
            open: () => {
              setOpenOn({ tabId: activeTabId });
              track('UI', 'Opened', 'Roadmap');
            },
          }
        : null,
    [stable, hasBoards, activeTabId],
  );
  const { byBoard, want, take } = useRoadmapsOnBoards(stable);
  const boards = useMemo<RoadmapBoards | null>(
    () =>
      stable
        ? {
            byBoard,
            want,
            manage: (boardId) => {
              setOpenOn({ tabId: activeTabId, boardId });
              track('UI', 'Opened', 'Roadmap');
            },
          }
        : null,
    [stable, byBoard, want, activeTabId],
  );
  return (
    <RoadmapDoorContext.Provider value={door}>
      <RoadmapBoardsContext.Provider value={boards}>
        {children}
        {stable && openOn ? (
          <RoadmapDialog
            scope={stable}
            startTabId={openOn.tabId}
            {...(openOn.boardId ? { startBoardId: openOn.boardId } : {})}
            cardTypes={itemTypes}
            onRoadmaps={take}
            onClose={() => setOpenOn(null)}
          />
        ) : null}
      </RoadmapBoardsContext.Provider>
    </RoadmapDoorContext.Provider>
  );
}
