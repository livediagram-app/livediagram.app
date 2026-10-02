// One reload guard (docs/specs/016-platform/stale-builds.md "One reload guard"): every reload the
// editor starts on its own after a deploy, whether the chunk recovery in the running app or the
// pre-boot guard in the page's head, claims the same allowance: one reload per page (path and query)
// within RELOAD_GUARD_WINDOW_MS, remembered in sessionStorage. Whichever path fires first takes it, so
// a failure that persists is reloaded once, then shown.

/** One reload per page within this window. */
export const RELOAD_GUARD_WINDOW_MS = 60_000;
/** The sessionStorage map of page to the time of its last guarded reload. */
export const RELOAD_GUARD_KEY = 'livediagram:stale-chunk-reloads';
/** Set on window once the running app's chunk recovery is installed: the page guard then stands down. */
export const APP_RECOVERY_FLAG = '__livediagramChunkRecovery';

/**
 * The claim itself. Self-contained on purpose (no reference outside its parameters, nothing but
 * plain JavaScript once types are stripped): the pre-boot guard embeds this function's source, so the
 * two paths run one implementation. True, and recorded, when the page has no reload inside the
 * window; storage that cannot be read refuses (better the error than a reload loop); junk restarts.
 */
export function claimReloadIn(
  storage: Storage,
  key: string,
  url: string,
  now: number,
  windowMs: number,
): boolean {
  const page = String(url).split('#')[0] ?? '';
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return false;
  }
  let seen: Record<string, number>;
  try {
    const parsed = JSON.parse(raw || '{}');
    seen = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    seen = {};
  }
  const last = seen[page];
  if (typeof last === 'number' && now - last <= windowMs) return false;
  const fresh: Record<string, number> = {};
  for (const other in seen) {
    const at = seen[other];
    if (typeof at === 'number' && now - at <= windowMs) fresh[other] = at;
  }
  fresh[page] = now;
  try {
    storage.setItem(key, JSON.stringify(fresh));
  } catch {
    return false;
  }
  return true;
}

/** The app's claim: one reload of `url` (its hash ignored) within the shared window. */
export function claimReload(url: string, storage: Storage, now: number): boolean {
  return claimReloadIn(storage, RELOAD_GUARD_KEY, url, now, RELOAD_GUARD_WINDOW_MS);
}
