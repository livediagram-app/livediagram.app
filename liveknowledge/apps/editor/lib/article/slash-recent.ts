// The slash menu's Recent (docs/specs/030-knowledgebase/page-surface.md "The slash menu"): the entries this person
// picks most, each pick weighing less the older it is, kept in this browser only. A per-viewer convenience: storage
// refused or wiped reads as no picks, and the menu shows no Recent.

/** Each entry's picks: how many (already decayed to `at`) and when last. */
export type SlashPicks = Readonly<Record<string, { weight: number; at: number }>>;

export const SLASH_RECENT_KEY = 'liveknowledge:v2:slash-recent';
/** How many entries Recent shows. */
export const SLASH_RECENT_MAX = 3;
// A pick a day old weighs half: picks halve each day.
const HALF_LIFE_MS = 24 * 60 * 60 * 1000;
// Entries kept in storage, so the record never grows past the catalogue.
const KEEP = 12;

const decayed = (weight: number, from: number, to: number) =>
  weight * Math.pow(0.5, Math.max(0, to - from) / HALF_LIFE_MS);

/** `picks` with one more pick of `id` at `now`; only the `KEEP` heaviest are kept. */
export function withPick(picks: SlashPicks, id: string, now: number): SlashPicks {
  const old = picks[id];
  const next = {
    ...picks,
    [id]: { weight: (old ? decayed(old.weight, old.at, now) : 0) + 1, at: now },
  };
  const kept = Object.entries(next)
    .sort(([, a], [, b]) => decayed(b.weight, b.at, now) - decayed(a.weight, a.at, now))
    .slice(0, KEEP);
  return Object.fromEntries(kept);
}

/** The ids Recent shows at `now`, heaviest first, the more recent first among equals; at most `max`, and only ids
 *  `known` holds (an entry since taken out of the menu never shows). */
export function recentIds(
  picks: SlashPicks,
  now: number,
  known: (id: string) => boolean,
  max = SLASH_RECENT_MAX,
): string[] {
  return Object.entries(picks)
    .filter(([id, p]) => known(id) && Number.isFinite(p.weight) && p.weight > 0)
    .map(([id, p]) => ({ id, w: decayed(p.weight, p.at, now), at: p.at }))
    .sort((a, b) => b.w - a.w || b.at - a.at)
    .slice(0, max)
    .map((e) => e.id);
}

/** The picks kept in this browser; none when storage is refused or holds something else. */
export function readSlashPicks(): SlashPicks {
  try {
    const raw = window.localStorage.getItem(SLASH_RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, { weight: number; at: number }> = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const p = v as { weight?: unknown; at?: unknown } | null;
      if (p && typeof p.weight === 'number' && typeof p.at === 'number')
        out[id] = { weight: p.weight, at: p.at };
    }
    return out;
  } catch {
    return {};
  }
}

/** One more pick of `id`, kept in this browser (a refused write is dropped: Recent is a convenience). */
export function noteSlashPick(id: string, now = Date.now()): void {
  try {
    window.localStorage.setItem(
      SLASH_RECENT_KEY,
      JSON.stringify(withPick(readSlashPicks(), id, now)),
    );
  } catch {
    // Storage refused (a private window, blocked site data): no Recent.
  }
}
