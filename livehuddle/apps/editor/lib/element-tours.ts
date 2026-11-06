import type { Element } from '@livehuddle/document';
import type { EditorCapabilities } from './editor-capabilities';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// Element tours (docs/specs/007-editor/element-tours.md): a tour of one complex element type, on the footer's
// Start Tour button while one is selected. The synced `elementTourKinds` lists the kinds taken, for Settings alone;
// `elementToursSeen` counts them all (tourTrackSeen).

// The Portal alone: the diagram elements' tours (timeline, chart, stack, lane, boundary, diagram key) went with them
// (Work Tracker #514); a stored answer naming one stays in `elementTourKinds`, unread.
export const ELEMENT_TOUR_KINDS = ['portal'] as const;

export type ElementTourKind = (typeof ELEMENT_TOUR_KINDS)[number];

// What each toured kind's offer and Settings row call its element, in a sentence ("a timeline").
export const ELEMENT_TOUR_NAMES: Record<ElementTourKind, string> = {
  portal: 'portal',
};

// The toured kind an element is, or null when its type has no tour.
export function elementTourKindOf(el: Element | null | undefined): ElementTourKind | null {
  return el?.type === 'shape' && el.shape === 'portal' ? 'portal' : null;
}

// Whether this session may take the element's tour: each tour teaches editing its element, so its kind's own edit
// gate decides (docs/specs/007-editor/element-tours.md "Share roles"), never isReadOnly alone.
export function canTourElement(
  can: Pick<EditorCapabilities, 'level'>,
  el: Element,
  kind: ElementTourKind,
): boolean {
  switch (kind) {
    // A portal's link is an Editor's, on an unlocked element (docs/specs/007-editor/element-tours.md "Share roles").
    case 'portal':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
  }
}

export function elementTourSeen(
  prefs: UserPreferences | null | undefined,
  kind: ElementTourKind,
): boolean {
  return tourTrackSeen(prefs?.elementTourKinds, prefs?.elementToursSeen, kind);
}

/** The preferences with `kind` answered. */
export function markElementTourSeen(
  prefs: UserPreferences,
  kind: ElementTourKind,
): UserPreferences {
  return { ...prefs, elementTourKinds: withTracksAnswered(prefs.elementTourKinds, [kind]) };
}

/**
 * The preferences with `kind` offered again (the Settings switch turned on): its answer forgotten, and the blanket
 * flag lifted, which would otherwise keep counting it as seen. Every other kind answered stays so.
 */
export function offerElementTourAgain(
  prefs: UserPreferences,
  kind: ElementTourKind,
): UserPreferences {
  const others = ELEMENT_TOUR_KINDS.filter((k) => k !== kind && elementTourSeen(prefs, k));
  const answered = (prefs.elementTourKinds ?? []).filter((k) => k !== kind);
  return {
    ...prefs,
    elementToursSeen: false,
    elementTourKinds: withTracksAnswered(answered, others),
  };
}
