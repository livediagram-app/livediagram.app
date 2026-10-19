import type { PageKind } from '@livediagram/document';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// The Pages tour's relaunch signal (docs/specs/007-editor/pages-tour.md "Where it appears"): the Settings
// row Tours › "Slides Tour" (or another kind's), turned on from off and closed, reruns the tour. A window event keeps the dialog
// decoupled from PagesTourHost, as the other tours' relaunches do.
export const PAGES_TOUR_RELAUNCH_EVENT = 'livediagram:pages-tour-relaunch';

export function requestPagesTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PAGES_TOUR_RELAUNCH_EVENT));
}

// Each page kind offers its own track once (docs/specs/007-editor/pages-tour.md "Where it appears"):
// `pagesTourKinds` lists the kinds answered; `pagesTourSeen` counts them all only for a power user
// (tourTrackSeen).
export const PAGES_TOUR_KINDS: readonly PageKind[] = ['slide', 'infographic', 'article', 'logo'];

export function pagesKindSeen(prefs: UserPreferences | null | undefined, kind: PageKind): boolean {
  return tourTrackSeen(prefs, prefs?.pagesTourKinds, prefs?.pagesTourSeen, kind);
}

/** Whether any kind's track is still owed. */
export function pagesTourOwed(prefs: UserPreferences | null | undefined): boolean {
  return PAGES_TOUR_KINDS.some((k) => !pagesKindSeen(prefs, k));
}

/** The preferences with `kind` answered. */
export function markPagesKindSeen(prefs: UserPreferences, kind: PageKind): UserPreferences {
  return { ...prefs, pagesTourKinds: withTracksAnswered(prefs.pagesTourKinds, [kind]) };
}
