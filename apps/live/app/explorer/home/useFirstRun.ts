'use client';

import { useEffect } from 'react';
import { clerkEnabled } from '@/lib/clerk-config';
import { useOptionalExplorer } from '../ExplorerContext';
import { isFirstRun } from './first-run';

// Whether Home is a first run (docs/specs/013-workspace/explorer-home.md "First run"), read from the Explorer's own
// lists, so it needs no read of its own, and whether to offer the way back to a signed-out person. Outside the
// Explorer (a test rendering Home alone) it is never a first run.
//
// The lists take a moment, and the hero's words depend on the answer, so the hero draws the answer this browser last
// saw for this person (`heroFirstRun`) until the lists land: no flash of the wrong greeting. A person this browser has
// never seen is taken as new, which a newcomer is. The body waits for the real answer (`firstRun`).

const SEEN_KEY = 'livediagram:v2:home-has-documents';

// The answer this browser last saw. A guest's id resolves a beat after the Explorer mounts; until it does, the
// browser's last answer stands for whoever is here (it is almost always the same person), so a returning guest
// never flashes the welcome nor fetches its previews.
function rememberedHasDocuments(ownerId: string | null): boolean | undefined {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return undefined;
    const seen = JSON.parse(raw) as { ownerId?: unknown; has?: unknown };
    if (typeof seen.has !== 'boolean') return undefined;
    return ownerId === null || seen.ownerId === ownerId ? seen.has : undefined;
  } catch {
    return undefined;
  }
}

export function useFirstRun(): {
  firstRun: boolean;
  heroFirstRun: boolean;
  signedIn: boolean;
  offerSignIn: boolean;
} {
  const explorer = useOptionalExplorer();
  const ownerId = explorer?.ownerId ?? null;
  const loading = explorer?.loading ?? true;
  const firstRun = explorer
    ? isFirstRun({
        loading: explorer.loading,
        documents: explorer.documents.length,
        shared: explorer.shared.length,
        teamDocuments: explorer.teamDocuments.length,
        offlineDocuments: explorer.offlineDocuments.length,
      })
    : false;

  const inExplorer = explorer !== null;
  useEffect(() => {
    if (!inExplorer || loading || !ownerId) return;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ownerId, has: !firstRun }));
    } catch {
      // Storage refused (a private window): the hero simply guesses again next time.
    }
  }, [inExplorer, loading, ownerId, firstRun]);

  if (!explorer)
    return { firstRun: false, heroFirstRun: false, signedIn: false, offerSignIn: false };
  // Until the lists land: new unless this browser last saw them hold something.
  const heroFirstRun = loading ? rememberedHasDocuments(ownerId) !== true : firstRun;
  // A guest on a deployment with sign-in may simply have been signed out.
  const signedIn = Boolean(explorer.clerkUserId);
  const offerSignIn = clerkEnabled && !signedIn;
  return { firstRun, heroFirstRun, signedIn, offerSignIn };
}
