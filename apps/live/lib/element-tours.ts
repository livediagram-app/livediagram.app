import type { Element, ShapeElement } from '@livediagram/document';
import type { EditorCapabilities } from './editor-capabilities';
import { canEditSankey } from './sankey-edit';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// Element tours (docs/specs/007-editor/element-tours.md): a tour of one complex element type, offered beside the
// selection toolbar the first time a person selects one. Each toured kind offers itself once ever: the synced
// `elementTourKinds` lists the kinds answered (Play or Cancel); `elementToursSeen` counts them all only for a power
// user (tourTrackSeen), as the Illustrate tour's kinds do.

export const ELEMENT_TOUR_KINDS = [
  'sankey',
  'layer-stack',
  'pyramid',
  'funnel',
  'cycle',
  'hub',
] as const;

export type ElementTourKind = (typeof ELEMENT_TOUR_KINDS)[number];

// What each toured kind's offer and Settings row call its element, in a sentence ("a Sankey diagram").
export const ELEMENT_TOUR_NAMES: Record<ElementTourKind, string> = {
  sankey: 'Sankey diagram',
  'layer-stack': 'layer stack',
  pyramid: 'pyramid',
  funnel: 'funnel',
  cycle: 'cycle',
  hub: 'hub and spoke',
};

// The toured kind an element is, or null when its type has no tour.
export function elementTourKindOf(el: Element | null | undefined): ElementTourKind | null {
  if (el?.type !== 'shape') return null;
  if (el.shape === 'sankey') return 'sankey';
  if (el.shape === 'layer-stack') return 'layer-stack';
  if (el.shape === 'pyramid' && (el as ShapeElement).pyramidVariant !== 'funnel') return 'pyramid';
  if (el.shape === 'pyramid' && (el as ShapeElement).pyramidVariant === 'funnel') return 'funnel';
  if (el.shape === 'cycle') return 'cycle';
  if (el.shape === 'hub') return 'hub';
  return null;
}

// Whether this session may take the element's tour: each tour teaches editing its element, so its kind's own edit
// gate decides (docs/specs/007-editor/element-tours.md "Share roles"), never isReadOnly alone.
export function canTourElement(
  can: Pick<EditorCapabilities, 'level'>,
  el: Element,
  kind: ElementTourKind,
): boolean {
  switch (kind) {
    case 'sankey':
      return canEditSankey(can, el);
    // A concept graphic's rows are structure, an Editor's on an unlocked element
    // (docs/specs/009-elements/concept-graphics.md "Share roles").
    case 'layer-stack':
    case 'hub':
    case 'cycle':
    case 'funnel':
    case 'pyramid':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
  }
}

export function elementTourSeen(
  prefs: UserPreferences | null | undefined,
  kind: ElementTourKind,
): boolean {
  return tourTrackSeen(prefs, prefs?.elementTourKinds, prefs?.elementToursSeen, kind);
}

/** The preferences with `kind` answered. */
export function markElementTourSeen(
  prefs: UserPreferences,
  kind: ElementTourKind,
): UserPreferences {
  return { ...prefs, elementTourKinds: withTracksAnswered(prefs.elementTourKinds, [kind]) };
}

/**
 * The preferences with `kind` offered again (the Settings switch turned on): its answer forgotten, and the power
 * user's blanket flag lifted, which would otherwise keep counting it as seen. Every other kind answered stays so.
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
