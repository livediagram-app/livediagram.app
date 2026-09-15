import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';

// The Appearance value and its side effects, split from the hook so both are
// reachable without React. The hook (useAppearance) owns the subscription and
// the telemetry; everything here is what "the appearance changed" actually
// means.
//
// Deliberately NOT a `'use client'` module: the key it reads lives in a plain
// module so the server layout can inline it (see appearance-storage), and a
// client boundary here would put one back in that import chain.

export type Appearance = 'light' | 'dark';

// Anything that is not the literal 'dark' reads as light. That covers a
// missing key, a value written by an older build, and a hand-edited or
// corrupted one — none of which should leave the editor in a mode the user
// cannot explain. Light is also the documented default: the toggle is opt-in,
// so prefers-color-scheme is deliberately NOT consulted (spec/07).
export function readAppearance(): Appearance {
  return readLocalStorageSafe(APPEARANCE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
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
let current: Appearance | null = null;
const listeners = new Set<() => void>();

export function getAppearance(): Appearance {
  if (current === null) current = readAppearance();
  return current;
}

// Always light on the server: the pre-hydration script applies the real value
// before paint, and reporting dark here would hydrate against markup that has
// not been rendered dark.
export function getServerAppearance(): Appearance {
  return 'light';
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Side effects live HERE rather than in a setState updater: React strict mode
// runs updaters twice in dev to surface impure callbacks, which double-fired
// the telemetry emit, double-wrote localStorage, and double-applied the class.
export function setAppearance(next: Appearance): void {
  current = next;
  writeLocalStorageSafe(APPEARANCE_STORAGE_KEY, next);
  applyAppearance(next);
  listeners.forEach((l) => l());
}

/** Test seam: drop the lazily-seeded value so the next read hits storage. */
export function resetAppearanceForTests(): void {
  current = null;
}
