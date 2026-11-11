// This browser's own opens of the documents stored only here (docs/specs/013-workspace/explorer-home.md
// "Opens").
//
// The server never sees an Offline Mode document, so it cannot count its opens. This Browser does,
// by the server's own rule: the UTC days with an open, inside the 90-day use window, and the last
// open, so Home's Recent places a local document among the rest. The record sits on the
// document's own record, so it goes wherever the record goes (the local Trash, a purge, Sync
// Document) and never leaves the browser.

import type { DocumentSummary } from '@livedocuments/api-schema';
import { localOpensOf, nextLocalOpens } from './local-opens';
import {
  offlineBackend,
  offlineUpdateRecord,
  recordToSummary,
  serializeOfflineWrite,
  type LocalOpens,
} from './offline-store';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export type { LocalOpens };

/** A local document that has been opened, as Home's Recent merges it. */
export type LocalOpenDocument = { document: DocumentSummary; opens: LocalOpens };

// Reading and moving on a record's opens (pure, local-opens.ts), kept importable from here.
export { localOpensOf, nextLocalOpens };

/** Count an open of a local document. Never throws: a failure is logged and the load goes on. */
export async function offlineRecordOpen(id: string, now: number): Promise<void> {
  try {
    await serializeOfflineWrite(async () => {
      let days = 0;
      await offlineUpdateRecord(id, (rec) => {
        if (!rec || rec.trashedAt !== undefined) return undefined;
        const opens = nextLocalOpens(localOpensOf(rec.opens), now);
        days = opens.days.length;
        // savedAt stays: an open is not an edit, and bumping it would reorder every list.
        return { ...rec, opens };
      });
      if (days > 0) debugLog(`[home] local-open-recorded days=${days}`);
    });
  } catch (err) {
    console.warn('[home] local-open-failed', err);
  }
}

/** Every live local document that has been opened, with its opens. */
export async function offlineListOpens(): Promise<LocalOpenDocument[]> {
  const recs = await offlineBackend().all();
  return recs.flatMap((rec) => {
    const opens = rec.trashedAt === undefined ? localOpensOf(rec.opens) : undefined;
    return opens ? [{ document: recordToSummary(rec), opens }] : [];
  });
}
