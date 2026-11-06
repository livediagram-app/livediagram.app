// The opens a local document's record holds (docs/specs/013-workspace/explorer-home.md "Opens"), read and moved on.
// Pure, and apart from the store: This Browser's list reads them (this-browser.ts), and the store imports that list,
// so these importing the store would close a cycle (offline-store -> this-browser -> offline-opens -> offline-store).

import { windowStartOf, utcDay } from '@livedocuments/api-schema';
import type { LocalOpens } from './offline-store';

/** A record's stored opens as the current shape. The shape written before Within reach still
 *  vouches for its last open day and last open; anything unreadable is never opened. */
export function localOpensOf(raw: unknown): LocalOpens | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.lastOpenedAt !== 'number') return undefined;
  if (Array.isArray(r.days) && r.days.every((d) => typeof d === 'string')) {
    return { days: r.days, lastOpenedAt: r.lastOpenedAt };
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
  const from = utcDay(windowStartOf(now));
  return {
    days: [day, ...(prev?.days ?? []).filter((d) => d !== day && d >= from)],
    lastOpenedAt: Math.max(prev?.lastOpenedAt ?? 0, now),
  };
}
