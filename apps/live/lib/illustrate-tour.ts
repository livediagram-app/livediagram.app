import type { PageKind } from '@livediagram/document';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
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
// `illustrateTourKinds` lists the kinds answered; `illustrateTourSeen` counts them all only for a power user
// (tourTrackSeen).
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
  return tourTrackSeen(prefs, prefs?.illustrateTourKinds, prefs?.illustrateTourSeen, kind);
}

/** Whether any kind's track is still owed: what the Settings row's switch shows. */
export function illustrateTourOwed(prefs: UserPreferences | null | undefined): boolean {
  return ILLUSTRATE_TOUR_KINDS.some((k) => !illustrateKindSeen(prefs, k));
}

/** The preferences with `kind` answered. */
export function markIllustrateKindSeen(prefs: UserPreferences, kind: PageKind): UserPreferences {
  return { ...prefs, illustrateTourKinds: withTracksAnswered(prefs.illustrateTourKinds, [kind]) };
}
