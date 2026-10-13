import type { PageKind } from '@livediagram/document';
import type { UserPreferences } from './user-preferences';

// The Illustrate tour's relaunch signal (docs/specs/007-editor/illustrate-tour.md "Where it appears"): the Settings
// row Tours › "Illustrate Tour", turned on from off and closed, reruns the tour. A window event keeps the dialog
// decoupled from IllustrateTourHost, as the other tours' relaunches do.
export const ILLUSTRATE_TOUR_RELAUNCH_EVENT = 'livediagram:illustrate-tour-relaunch';

export function requestIllustrateTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ILLUSTRATE_TOUR_RELAUNCH_EVENT));
}

// Each page kind offers its own track once (docs/specs/007-editor/illustrate-tour.md "Where it appears"):
// `illustrateTourSeen` counts every kind as seen; otherwise `illustrateTourKinds` lists the kinds answered.
export const ILLUSTRATE_TOUR_KINDS: readonly PageKind[] = [
  'slide',
  'infographic',
  'article',
  'logo',
];

export function illustrateKindSeen(
  prefs: UserPreferences | null | undefined,
  kind: PageKind,
): boolean {
  return prefs?.illustrateTourSeen === true || (prefs?.illustrateTourKinds ?? []).includes(kind);
}

/** The preferences with `kind` answered; once every kind is, the whole tour counts as seen. */
export function markIllustrateKindSeen(prefs: UserPreferences, kind: PageKind): UserPreferences {
  const kinds = [...new Set([...(prefs.illustrateTourKinds ?? []), kind])];
  const all = ILLUSTRATE_TOUR_KINDS.every((k) => kinds.includes(k));
  return { ...prefs, illustrateTourKinds: kinds, ...(all ? { illustrateTourSeen: true } : {}) };
}
