'use client';

// Gives the editor its door to Publish as Roadmap (RoadmapContext), the Tools row's, and draws the dialog while it is
// open (docs/specs/026-plan/public-roadmap.md "Where it lives"). The door is there only on a plan with a Plan board on
// any tab; the dialog picks the tab, starting on the one in view. The
// dialog's code loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose people
// never open it pays nothing for it.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { RoadmapDoorContext, type RoadmapDoor } from './RoadmapContext';
import type { RoadmapScope } from './roadmap-gate';

const RoadmapDialog = dynamic(() => import('./RoadmapDialog').then((m) => m.RoadmapDialog), {
  ssr: false,
});

export function RoadmapHost({
  scope,
  hasBoards,
  activeTabId,
  children,
}: {
  // Null for anyone who may not publish (roadmapScopeFor).
  scope: RoadmapScope | null;
  // Whether any tab of the plan holds a Plan board.
  hasBoards: boolean;
  // The tab in view, where the dialog starts when it holds a board.
  activeTabId: string;
  children: ReactNode;
}) {
  // Taken when the dialog opens, so switching tabs behind it does not move it.
  const [openOn, setOpenOn] = useState<string | null>(null);
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
              setOpenOn(activeTabId);
              track('UI', 'Opened', 'Roadmap');
            },
          }
        : null,
    [stable, hasBoards, activeTabId],
  );
  return (
    <RoadmapDoorContext.Provider value={door}>
      {children}
      {stable && openOn ? (
        <RoadmapDialog scope={stable} startTabId={openOn} onClose={() => setOpenOn(null)} />
      ) : null}
    </RoadmapDoorContext.Provider>
  );
}
