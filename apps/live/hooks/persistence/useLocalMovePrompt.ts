'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@livediagram/ui';
import { offlineListDocuments } from '@/lib/offline/offline-store';
import { saveOfflineToCloud } from '@/lib/offline/offline-convert';
import { dismissLocalMove, shouldOfferLocalMove } from '@/lib/offline/local-move-dismissal';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';
import type { ImportChecklistRow } from '@/components/dialogs/ImportChecklist';

// The move prompt after signing in (docs/specs/014-identity/auth-and-guest-access.md "Moving Local only
// documents after signing in"): once auth settles signed in, offer to move this browser's Local only
// documents into the account. Move runs Sync Document on each ticked one in turn; a failure stays
// Local only and is named; Not Now is remembered until the count grows.

export type LocalMovePhase =
  | { kind: 'idle' }
  | { kind: 'offer' }
  | { kind: 'moving'; done: number; total: number }
  // Some stayed Local only: their names, and whether any moved (the page reloads to show them).
  | { kind: 'partial'; failed: string[]; moved: number };

export function useLocalMovePrompt(opts: {
  enabled: boolean;
  authLoaded: boolean;
  clerkUserId: string | null | undefined;
}) {
  const { enabled, authLoaded, clerkUserId } = opts;
  const [phase, setPhase] = useState<LocalMovePhase>({ kind: 'idle' });
  const [rows, setRows] = useState<ImportChecklistRow[]>([]);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!enabled || !authLoaded || !clerkUserId) return;
    let live = true;
    void offlineListDocuments()
      .then((docs) => {
        if (!live || !shouldOfferLocalMove(clerkUserId, docs.length)) return;
        const now = Date.now();
        const sorted = [...docs].sort((a, b) => b.savedAt - a.savedAt);
        setRows(
          sorted.map((d) => ({
            key: d.id,
            name: d.name,
            detail: `Edited ${formatRelativeTime(now - d.savedAt)}`,
          })),
        );
        setChecked(new Set(sorted.map((d) => d.id)));
        setPhase({ kind: 'offer' });
        debugLog(`[local-move] offered count=${docs.length}`);
        track('UI', 'Opened', 'LocalMovePrompt');
      })
      .catch((err: unknown) => debugLog(`[local-move] listing failed: ${String(err)}`));
    return () => {
      live = false;
    };
  }, [enabled, authLoaded, clerkUserId]);

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () =>
    setChecked((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.key))));

  const notNow = () => {
    if (!clerkUserId) return;
    dismissLocalMove(clerkUserId, rows.length);
    track('UI', 'Closed', 'LocalMovePrompt');
    setPhase({ kind: 'idle' });
  };

  const move = async () => {
    if (!clerkUserId || phase.kind !== 'offer') return;
    const picked = rows.filter((r) => checked.has(r.key));
    if (picked.length === 0) return;
    track('UI', 'Selected', 'LocalMovePrompt');
    const failed: string[] = [];
    for (const [i, row] of picked.entries()) {
      setPhase({ kind: 'moving', done: i, total: picked.length });
      try {
        await saveOfflineToCloud(row.key, clerkUserId);
        track('Document', 'Moved', 'SavedToCloud');
      } catch (err) {
        console.warn('[local-move] a document stayed Local only', err);
        failed.push(row.name);
      }
    }
    const moved = picked.length - failed.length;
    debugLog(`[local-move] moved=${moved} failed=${failed.length}`);
    // What is left local was offered and not taken, or could not move: not asked about again
    // until there is more.
    dismissLocalMove(clerkUserId, rows.length - moved);
    if (failed.length === 0) window.location.reload();
    else setPhase({ kind: 'partial', failed, moved });
  };

  // After a partial move: reload to show what moved, or just close when nothing did.
  const finish = () => {
    if (phase.kind === 'partial' && phase.moved > 0) window.location.reload();
    else setPhase({ kind: 'idle' });
  };

  return { phase, rows, checked, toggle, toggleAll, notNow, move, finish };
}
