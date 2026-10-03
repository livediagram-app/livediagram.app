// This browser's own opens of the documents stored only here (docs/specs/013-workspace/explorer-home.md
// "Opens"; blueprint docs/specs/013-workspace/blueprints/explorer-home-view.md "Local opens").
//
// The server never sees an Offline Mode document, so it cannot count its opens. This browser does,
// by the server's own rule: the UTC days with an open, inside the 90-day use window, and the last
// open, so Home's Jump back in places a local document among the rest. The record sits on the
// document's own record, so it goes wherever the record goes (the local Trash, a purge, Sync
// Document) and never leaves the browser.

import type { DocumentSummary } from '@livediagram/api-schema';
import { useWindowStart, utcDay } from '@livediagram/api-schema';
import {
  offlineBackend,
  recordToSummary,
  serializeOfflineWrite,
  type LocalOpens,
} from './offline-store';
import { debugLog } from '@/lib/debug-log';

export type { LocalOpens };

/** A local document that has been opened, as Jump back in merges it. */
export type LocalOpenDocument = { document: DocumentSummary; opens: LocalOpens };

/** A record's stored opens as the current shape. The shape written before Within reach still
 *  vouches for its last open day and last open; anything unreadable is never opened. */
export function localOpensOf(raw: unknown): LocalOpens | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.lastOpenedAt !== 'number') return undefined;
  if (Array.isArray(r.days) && r.days.every((d) => typeof d === 'string')) {
    return { days: r.days as string[], lastOpenedAt: r.lastOpenedAt };
  }
  if (typeof r.lastOpenDay === 'string') {
    return { days: [r.lastOpenDay], lastOpenedAt: r.lastOpenedAt };
  }
  return undefined;
}

/** The opens after one at `now`: its day first (once), days before the window dropped, and the
 *  last open moved forwards. */
export function nextLocalOpens(prev: LocalOpens | undefined, now: number): LocalOpens {
  const day = utcDay(now);
  const from = utcDay(useWindowStart(now));
  return {
    days: [day, ...(prev?.days ?? []).filter((d) => d !== day && d >= from)],
    lastOpenedAt: Math.max(prev?.lastOpenedAt ?? 0, now),
  };
}

/** Count an open of a local document. Never throws: a failure is logged and the load goes on. */
export async function offlineRecordOpen(id: string, now: number): Promise<void> {
  try {
    await serializeOfflineWrite(async () => {
      const rec = await offlineBackend().get(id);
      if (!rec || rec.trashedAt !== undefined) return;
      const opens = nextLocalOpens(localOpensOf(rec.opens), now);
      // savedAt stays: an open is not an edit, and bumping it would reorder every list.
      await offlineBackend().put({ ...rec, opens });
      debugLog(`[home] local-open-recorded days=${opens.days.length}`);
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
