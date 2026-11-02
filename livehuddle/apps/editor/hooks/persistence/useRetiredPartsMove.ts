'use client';

import { useCallback, useState } from 'react';
import type { MigrationApp } from '@liveworkspace/migration';
import { apiMoveLocalParts } from '@/lib/api/migration';
import { LOCAL_IDENTITY_KEYS } from '@/lib/local-identity';
import { listRetiredParts, localPartsBody, settleRetiredParts } from '@/lib/offline/retired-parts';
import { readLocalStorageSafe } from '@liveworkspace/workbench/lib/local-storage-safe';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// Moving the parts set aside from documents in This Browser to the apps they now belong to
// (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps"): the dialog's phases, shared
// by the offer on load and Settings' row. One document at a time, each as the person (`ownerId`), sending the whole
// raw record (localPartsBody); a failure keeps that document's record and its set-aside copy exactly as they were.

export type RetiredPartsRow = { id: string; name: string };
export type MovedPart = { app: MigrationApp; url: string };
export type MovedDocument = { id: string; name: string; parts: MovedPart[] };

export type RetiredPartsPhase =
  | { kind: 'idle' }
  | { kind: 'offer'; rows: RetiredPartsRow[] }
  | { kind: 'moving'; done: number; total: number }
  | { kind: 'result'; moved: MovedDocument[]; failed: string[] };

// What a document is called in the list when it never had a name.
const UNNAMED = 'Untitled canvas';

export async function loadRetiredPartsRows(): Promise<RetiredPartsRow[]> {
  const records = await listRetiredParts();
  return records
    .map((r) => ({ id: r.id, name: r.name?.trim() || UNNAMED }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// One pass over every set-aside document. Exported for the tests; the hook drives the dialog with it.
export async function moveRetiredParts(
  ownerId: string,
  onProgress: (done: number, total: number) => void,
): Promise<{ moved: MovedDocument[]; failed: string[] }> {
  const records = await listRetiredParts();
  const oldOwnerId = readLocalStorageSafe(LOCAL_IDENTITY_KEYS.legacyGuestId);
  const moved: MovedDocument[] = [];
  const failed: string[] = [];
  for (const [i, record] of records.entries()) {
    onProgress(i, records.length);
    const name = record.name?.trim() || UNNAMED;
    try {
      const answer = await apiMoveLocalParts(ownerId, localPartsBody(record, oldOwnerId));
      await settleRetiredParts(record.id, answer.keep);
      moved.push({
        id: record.id,
        name,
        parts: answer.parts.map((p) => ({ app: p.app, url: p.url })),
      });
      track('Document', 'Moved', 'RetiredParts');
    } catch (err) {
      console.warn('[retired-parts] move-failed, kept in this browser', err);
      failed.push(name);
    }
  }
  debugLog(`[retired-parts] moved=${moved.length} failed=${failed.length}`);
  return { moved, failed };
}

export function useRetiredPartsMove(ownerId: string | null) {
  const [phase, setPhase] = useState<RetiredPartsPhase>({ kind: 'idle' });

  const offer = useCallback(async (): Promise<boolean> => {
    const rows = await loadRetiredPartsRows();
    if (rows.length === 0) return false;
    setPhase({ kind: 'offer', rows });
    track('UI', 'Opened', 'RetiredPartsOffer');
    return true;
  }, []);

  const move = useCallback(async () => {
    if (!ownerId || phase.kind !== 'offer') return;
    track('UI', 'Selected', 'RetiredPartsOffer');
    const result = await moveRetiredParts(ownerId, (done, total) =>
      setPhase({ kind: 'moving', done, total }),
    );
    setPhase({ kind: 'result', ...result });
  }, [ownerId, phase.kind]);

  const notNow = useCallback(() => {
    track('UI', 'Closed', 'RetiredPartsOffer');
    setPhase({ kind: 'idle' });
  }, []);

  const close = useCallback(() => setPhase({ kind: 'idle' }), []);

  return { phase, offer, move, notNow, close };
}
