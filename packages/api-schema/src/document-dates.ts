// A document's own dates on create (docs/specs/015-api/api.md "Document dates"): an Offline Mode
// sync carries its record's created date, an imported board its own created and last-modified
// dates. Untrusted input, so each is checked: a whole number of ms since the epoch, from
// DOCUMENT_DATE_MIN to now plus DOCUMENT_DATE_SKEW_MS, created no later than modified.

// 1 January 2000: before any document a person could bring, after every broken clock's zero.
export const DOCUMENT_DATE_MIN = Date.UTC(2000, 0, 1);
// A device clock running ahead of the server's by up to a day is still trusted.
export const DOCUMENT_DATE_SKEW_MS = 86_400_000;

export type DocumentDates = { ok: true; createdAt: number; savedAt: number } | { ok: false };

const valid = (v: unknown, now: number): v is number =>
  typeof v === 'number' &&
  Number.isInteger(v) &&
  v >= DOCUMENT_DATE_MIN &&
  v <= now + DOCUMENT_DATE_SKEW_MS;

/** The dates a create stores: the body's own when valid, now for any it leaves out. */
export function documentDates(
  body: { createdAt?: unknown; savedAt?: unknown },
  now: number,
): DocumentDates {
  const { createdAt, savedAt } = body;
  if (createdAt === undefined) {
    return savedAt === undefined ? { ok: true, createdAt: now, savedAt: now } : { ok: false };
  }
  if (!valid(createdAt, now)) return { ok: false };
  if (savedAt === undefined) return { ok: true, createdAt, savedAt: Math.max(now, createdAt) };
  if (!valid(savedAt, now) || savedAt < createdAt) return { ok: false };
  return { ok: true, createdAt, savedAt };
}
