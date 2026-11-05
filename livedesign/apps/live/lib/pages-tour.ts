import type { PageKind } from '@livedesign/design';
import { withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// The Pages tour's relaunch signal (docs/specs/007-editor/pages-tour.md "Where it appears"): the Settings
// row Tours › "Logo Tour" (or another kind's), turned on from off and closed, reruns the tour. A window event keeps the dialog
// decoupled from PagesTourHost, as the other tours' relaunches do.
export const PAGES_TOUR_RELAUNCH_EVENT = 'livedesign:pages-tour-relaunch';

export function requestPagesTourRelaunch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PAGES_TOUR_RELAUNCH_EVENT));
}

// Each page kind offers its own track once (docs/specs/007-editor/pages-tour.md "Where it appears"):
// `pagesTourKinds` lists the kinds answered. The older single flag `pagesTourSeen` counts none: an answer given to the
// single tour before it split stands for no kind in particular, so each is offered once more. The one place it meant
// "every kind" was the retired Power user mode's preset, and that is folded into the list as the blob is read
// (upgradeLegacyPreferences in @livedesign/api-schema).
export const PAGES_TOUR_KINDS: readonly PageKind[] = ['wireframe', 'logo', 'photo'];

export function pagesKindSeen(prefs: UserPreferences | null | undefined, kind: PageKind): boolean {
  return (prefs?.pagesTourKinds ?? []).includes(kind);
}

/** The preferences with `kind` answered. */
export function markPagesKindSeen(prefs: UserPreferences, kind: PageKind): UserPreferences {
  return { ...prefs, pagesTourKinds: withTracksAnswered(prefs.pagesTourKinds, [kind]) };
}
