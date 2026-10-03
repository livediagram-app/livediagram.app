// This browser's own opens of the documents stored only here (docs/specs/013-workspace/explorer-home.md
// "Opens"; blueprint docs/specs/013-workspace/blueprints/explorer-home-view.md "Local opens").
//
// The server never sees an Offline Mode document, so it cannot count its opens. This browser does,
// by the server's own rule: once per UTC day, keyed by the same frecency, so Home's Jump back in
// ranks a local document among the rest. The count sits on the document's own record, so it goes
// wherever the record goes (the local Trash, a purge, Sync Document) and never leaves the browser.

import type { DocumentSummary } from '@livediagram/api-schema';
import { nextFrecencyKey, utcDay } from '@livediagram/api-schema';
import {
  offlineBackend,
  recordToSummary,
  serializeOfflineWrite,
  type LocalOpens,
} from './offline-store';

export type { LocalOpens };

/** A local document that has been opened, as Jump back in merges it. */
export type LocalOpenDocument = { document: DocumentSummary; opens: LocalOpens };

/** The opens after one at `now`, or null when today already counted. */
export function nextLocalOpens(prev: LocalOpens | undefined, now: number): LocalOpens | null {
  const day = utcDay(now);
  if (prev?.lastOpenDay === day) return null;
  return {
    openDays: (prev?.openDays ?? 0) + 1,
    lastOpenDay: day,
    lastOpenedAt: now,
    frecencyKey: nextFrecencyKey(prev?.frecencyKey ?? null, now),
  };
}

/** Count an open of a local document. Never throws: a failure is logged and the load goes on. */
export async function offlineRecordOpen(id: string, now: number): Promise<void> {
  try {
    await serializeOfflineWrite(async () => {
      const rec = await offlineBackend().get(id);
      if (!rec || rec.trashedAt !== undefined) return;
      const opens = nextLocalOpens(rec.opens, now);
      if (!opens) {
        console.info('[home] local-open-skipped reason=same-day');
        return;
      }
      // savedAt stays: an open is not an edit, and bumping it would reorder every list.
      await offlineBackend().put({ ...rec, opens });
      console.info(`[home] local-open-recorded days=${opens.openDays}`);
    });
  } catch (err) {
    console.warn('[home] local-open-failed', err);
  }
}

/** Every live local document that has been opened, with its opens. */
export async function offlineListOpens(): Promise<LocalOpenDocument[]> {
  const recs = await offlineBackend().all();
  return recs.flatMap((rec) =>
    rec.trashedAt === undefined && rec.opens
      ? [{ document: recordToSummary(rec), opens: rec.opens }]
      : [],
  );
}
