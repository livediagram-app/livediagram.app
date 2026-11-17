'use client';

// Gives the editor its door to Publish as Roadmap (RoadmapContext) and draws the dialog while it is open
// (docs/specs/026-plan/public-roadmap.md "Where it lives"). The door is there only on a tab holding a Plan board. The
// dialog's code loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose people
// never open it pays nothing for it.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';
import { track } from '@/lib/telemetry';
import { RoadmapDoorContext, type RoadmapDoor } from './RoadmapContext';
import type { RoadmapScope } from './roadmap-gate';

const RoadmapDialog = dynamic(() => import('./RoadmapDialog').then((m) => m.RoadmapDialog), {
  ssr: false,
});

export function RoadmapHost({
  scope,
  boardIds,
  itemTypes,
  children,
}: {
  // Null for anyone who may not publish (roadmapScopeFor).
  scope: RoadmapScope | null;
  // The Plan boards on the tab the menu is for, in its order (boardIdsOnTab).
  boardIds: readonly string[];
  // The plan's card types and their changes, for the dialog's Add Votes (public-roadmap.md "The settings"); absent
  // outside a plan's editor.
  itemTypes?: ItemTypesSlice | undefined;
  children: ReactNode;
}) {
  // Taken when the dialog opens, so an edit on the canvas behind it does not move it to another board.
  const [openOn, setOpenOn] = useState<readonly string[] | null>(null);
  const { ownerId, projectId } = scope ?? {};
  const stable = useMemo<RoadmapScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId } : null),
    [ownerId, projectId],
  );
  const key = boardIds.join('\n');
  const door = useMemo<RoadmapDoor | null>(
    () =>
      stable && key
        ? {
            open: () => {
              setOpenOn(key.split('\n'));
              track('UI', 'Opened', 'Roadmap');
            },
          }
        : null,
    [stable, key],
  );
  return (
    <RoadmapDoorContext.Provider value={door}>
      {children}
      {stable && openOn ? (
        <RoadmapDialog
          scope={stable}
          boardIds={openOn}
          cardTypes={itemTypes}
          onClose={() => setOpenOn(null)}
        />
      ) : null}
    </RoadmapDoorContext.Provider>
  );
}
