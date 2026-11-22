// The windows of time the room counts in, all UTC: a day (`2026-11-20`) and an hour (`2026-11-20T14`).

const DAY_MS = 86_400_000;

/** The UTC day of a moment (epoch ms), `YYYY-MM-DD`. */
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The UTC hour of a moment, `YYYY-MM-DDTHH`. */
export const hourOf = (ms: number): string => new Date(ms).toISOString().slice(0, 13);

/** The UTC day `days` days before a moment. */
export const daysBefore = (ms: number, days: number): string => dayOf(ms - days * DAY_MS);
