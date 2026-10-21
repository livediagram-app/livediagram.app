import { APPEARANCE_STORAGE_KEY, DARK_MEDIA_QUERY } from './appearance-storage';

// The Appearance value and its side effects, shared by every app on the origin
// (docs/specs/004-interface-design/appearance.md), split from the hook so both are
// reachable without React. The hook (useAppearance) owns the subscription and
// the telemetry; everything here is what "the appearance changed" actually
// means.
//
// Two types, because the user's PICK and the chrome that results from it are
// no longer the same thing: `AppearanceSetting` is what's stored (Light / Dark
// / System), `Appearance` is what's painted (Light / Dark). System is the only
// setting that resolves through the OS, and it keeps resolving — the media
// query is watched, so the chrome follows an OS that flips at sunset.
//
// Deliberately NOT a `'use client'` module: the key it reads lives in a plain
// module so the server layout can inline it (see appearance-storage), and a
// client boundary here would put one back in that import chain.

/** What the chrome is painted as. */
export type Appearance = 'light' | 'dark';
/** What the user picked. */
export type AppearanceSetting = Appearance | 'system';

// Storage can be absent (the server) or throw (private mode, partitioned storage);
// either way the setting falls back to the default and a write lasts the session.
function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
  } catch {
    // Quota / private browsing: in-memory only.
  }
}

// The default, for a visitor who has never touched the control: follow the
// device. Somebody whose machine is dark has already said what they want, and
// System is the setting that hears it.
export const DEFAULT_APPEARANCE_SETTING: AppearanceSetting = 'system';

// Anything that is not one of the three literals reads as the default. That
// covers a missing key, a value written by an older build, and a hand-edited or
// corrupted one — none of which should leave the page in a mode the user
// cannot explain. An explicit Light or Dark still wins over the device: System
// is where the choice STARTS, not a rule (docs/specs/004-interface-design/appearance.md).
export function readAppearanceSetting(): AppearanceSetting {
  const stored = readStored();
  return stored === 'dark' || stored === 'light' || stored === 'system'
    ? stored
    : DEFAULT_APPEARANCE_SETTING;
}

// The live MediaQueryList, created once. Undefined on the server and in any
// browser too old to have matchMedia, where System simply reads as light.
let mediaQuery: MediaQueryList | undefined;
let mediaQueryChecked = false;

function darkMedia(): MediaQueryList | undefined {
  // Re-check while nothing is cached: tests (and the server render) can reach
  // this before a window exists, and one early miss must not pin the answer.
  if (!mediaQueryChecked || !mediaQuery) {
    mediaQuery =
      typeof window === 'undefined' || typeof window.matchMedia !== 'function'
        ? undefined
        : window.matchMedia(DARK_MEDIA_QUERY);
    mediaQueryChecked = true;
  }
  return mediaQuery;
}

/** Resolve a setting to the chrome it paints. Only System asks the OS. */
export function resolveAppearance(setting: AppearanceSetting): Appearance {
  if (setting !== 'system') return setting;
  return darkMedia()?.matches ? 'dark' : 'light';
}

// The DOM half. Guarded for the server, where there is no document and the
// pre-hydration script has already done this job.
export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (appearance === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}

// null until first read so the store seeds lazily on the client; getSnapshot
// must stay pure, so seeding happens there but writing back to localStorage /
// the DOM only ever happens in setAppearance.
let current: AppearanceSetting | null = null;
const listeners = new Set<() => void>();

export function getAppearanceSetting(): AppearanceSetting {
  if (current === null) current = readAppearanceSetting();
  return current;
}

// A setting that wins over the stored one and is never stored: a workbench frame paints the scheme its
// workbench sends (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB15), and System until
// one arrives, whatever the frame's partitioned storage holds. Null hands back to the setting.
let override: AppearanceSetting | null = null;

// What is painted from: the override when set, else the stored setting.
function effectiveSetting(): AppearanceSetting {
  return override ?? getAppearanceSetting();
}

export function getResolvedAppearance(): Appearance {
  return resolveAppearance(effectiveSetting());
}

export function setAppearanceOverride(next: AppearanceSetting | null): void {
  override = next;
  watchSystem();
  applyAppearance(getResolvedAppearance());
  listeners.forEach((l) => l());
}

// Always light on the server: the pre-hydration script applies the real value
// before paint, and reporting dark here would hydrate against markup that has
// not been rendered dark.
export function getServerAppearance(): Appearance {
  return 'light';
}

// The setting the server renders a control with: the default, which is what most
// readers hold, so the control rarely changes its glyph on hydration.
export function getServerAppearanceSetting(): AppearanceSetting {
  return DEFAULT_APPEARANCE_SETTING;
}

export function subscribeAppearance(listener: () => void): () => void {
  watchSystem();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Watch the OS preference for as long as the page lives. Attached lazily (the
// first subscribe or write) rather than at import, so a server render and the
// pre-hydration path never touch matchMedia; never detached, because the thing
// it guards — the `dark` class on <html> — outlives any one subscriber.
let watching = false;
function watchSystem(): void {
  if (watching) return;
  const media = darkMedia();
  if (!media) return;
  watching = true;
  media.addEventListener('change', () => {
    // An explicit Light / Dark ignores the OS entirely; only System repaints.
    if (effectiveSetting() !== 'system') return;
    applyAppearance(getResolvedAppearance());
    listeners.forEach((l) => l());
  });
}

// Side effects live HERE rather than in a setState updater: React strict mode
// runs updaters twice in dev to surface impure callbacks, which double-fired
// the telemetry emit, double-wrote localStorage, and double-applied the class.
export function setAppearance(next: AppearanceSetting): void {
  current = next;
  writeStored(next);
  watchSystem();
  applyAppearance(getResolvedAppearance());
  listeners.forEach((l) => l());
}

/** Test seam: drop the lazily-seeded value so the next read hits storage. */
export function resetAppearanceForTests(): void {
  current = null;
  override = null;
  mediaQuery = undefined;
  mediaQueryChecked = false;
  watching = false;
  listeners.clear();
}
