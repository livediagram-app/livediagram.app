'use client';

// The plan's published roadmaps by board, for the boards' Roadmap pills (docs/specs/026-plan/public-roadmap.md "On the
// board"): one managing read, on the first `want()` (the first board header drawn), kept while the plan is open and
// shared by every header; the dialog's own list (`take`) replaces it on each read and write there, so it is never read
// again. A read still in flight when the dialog has spoken is dropped, so it never undoes a Publish or an Unpublish.
// A failed read leaves no pills, not retried until the plan opens again.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PublishedRoadmap } from '@liveplanner/api-schema';
import { readRoadmaps } from './roadmap-client';
import type { RoadmapScope } from './roadmap-gate';

export type RoadmapsOnBoards = {
  byBoard: ReadonlyMap<string, PublishedRoadmap> | null;
  want: () => void;
  // The dialog's list of published roadmaps, every time it changes.
  take: (roadmaps: readonly PublishedRoadmap[]) => void;
};

const mapOf = (roadmaps: readonly PublishedRoadmap[]) =>
  new Map(roadmaps.map((r) => [r.boardId, r] as const));

export function useRoadmapsOnBoards(scope: RoadmapScope | null): RoadmapsOnBoards {
  const [byBoard, setByBoard] = useState<ReadonlyMap<string, PublishedRoadmap> | null>(null);
  // The scope the read was asked for, and whether the dialog has given a newer list since.
  const asked = useRef<RoadmapScope | null>(null);
  const spoken = useRef(false);
  const [held, setHeld] = useState(scope);
  if (held !== scope) {
    // Another plan (or no one who may publish): what was read is not this one's.
    setHeld(scope);
    setByBoard(null);
  }
  const want = useCallback(() => {
    if (!scope || asked.current === scope) return;
    asked.current = scope;
    spoken.current = false;
    readRoadmaps(scope).then(
      (r) => {
        if (asked.current === scope && !spoken.current) setByBoard(mapOf(r.roadmaps));
      },
      () => {
        // No pills; the dialog still reads on its own when opened.
      },
    );
  }, [scope]);
  const take = useCallback((roadmaps: readonly PublishedRoadmap[]) => {
    spoken.current = true;
    setByBoard(mapOf(roadmaps));
  }, []);
  return useMemo(() => ({ byBoard, want, take }), [byBoard, want, take]);
}
