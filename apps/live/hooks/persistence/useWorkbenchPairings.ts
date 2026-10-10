'use client';

// A signed-in person's paired workbenches (docs/specs/013-workspace/workbench-embeds.md "Pairing"; blueprint
// "Settings > API tokens", WB46): `GET /api/workbench/pairings` once, grouped by token here, and Unpair, which
// removes the row once the api has ended that pairing.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkbenchPairing } from '@livediagram/api-schema';
import { apiListWorkbenchPairings, apiUnpairWorkbench } from '@/lib/api-client';

const NONE: readonly WorkbenchPairing[] = [];

export type WorkbenchPairingsController = {
  // A token's pairings, in the api's order (newest first); none is an empty list.
  forToken: (tokenId: string) => readonly WorkbenchPairing[];
  unpair: (pairingId: string) => Promise<void>;
};

function groupByToken(pairings: readonly WorkbenchPairing[]): Map<string, WorkbenchPairing[]> {
  const groups = new Map<string, WorkbenchPairing[]>();
  for (const p of pairings) groups.set(p.tokenId, [...(groups.get(p.tokenId) ?? []), p]);
  return groups;
}

export function useWorkbenchPairings(
  ownerId: string | null,
  opts: { enabled: boolean },
): WorkbenchPairingsController {
  const enabled = opts.enabled && !!ownerId;
  const [pairings, setPairings] = useState<readonly WorkbenchPairing[]>(NONE);

  useEffect(() => {
    if (!enabled || !ownerId) return;
    let live = true;
    apiListWorkbenchPairings(ownerId)
      .then((list) => {
        if (live) setPairings(list);
      })
      .catch(() => console.warn('[workbench] pairings-list-failed'));
    return () => {
      live = false;
    };
  }, [enabled, ownerId]);

  const groups = useMemo(() => groupByToken(pairings), [pairings]);
  const forToken = useCallback((tokenId: string) => groups.get(tokenId) ?? NONE, [groups]);

  const unpair = useCallback(
    async (pairingId: string) => {
      if (!ownerId) return;
      try {
        await apiUnpairWorkbench(ownerId, pairingId);
        setPairings((list) => list.filter((p) => p.id !== pairingId));
      } catch {
        console.warn('[workbench] unpair-failed');
      }
    },
    [ownerId],
  );

  return { forToken, unpair };
}
