import { isChartShape, isFlowchartStep, type Element } from '@livepages/document';
import type { EditorCapabilities } from './editor-capabilities';
import { canEditSankey } from './sankey-edit';
import { canEditSequence } from './sequence-edit';
import { tourTrackSeen, withTracksAnswered } from './tour-tracks';
import type { UserPreferences } from './user-preferences';

// Element tours (docs/specs/007-editor/element-tours.md): a tour of one complex element type, offered beside the
// selection toolbar the first time a person selects one. Each toured kind offers itself once ever: the synced
// `elementTourKinds` lists the kinds answered (Play or Cancel); `elementToursSeen` counts them all only for a power
// user (tourTrackSeen), as the Pages tour's kinds do.

export const ELEMENT_TOUR_KINDS = [
  'sankey',
  'layer-stack',
  'pyramid',
  'funnel',
  'cycle',
  'hub',
  'onion',
  'chevrons',
  'timeline',
  'mind-node',
  'flowchart',
  'org-chart',
  'sequence',
  'chart',
  'stack',
  'entity',
  'tab-window',
  'lane',
  'boundary',
  'diagram-key',
  'portal',
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
  onion: 'onion',
  chevrons: 'chevron process',
  timeline: 'timeline',
  'mind-node': 'mind map node',
  flowchart: 'flowchart step',
  'org-chart': 'person in an org chart',
  sequence: 'sequence diagram',
  chart: 'chart',
  stack: 'stack',
  entity: 'entity',
  'tab-window': 'tab window',
  lane: 'lane',
  boundary: 'boundary',
  'diagram-key': 'diagram key',
  portal: 'portal',
};

// The toured kind an element is, or null when its type has no tour.
export function elementTourKindOf(el: Element | null | undefined): ElementTourKind | null {
  if (el?.type !== 'shape') return null;
  if (el.shape === 'sankey') return 'sankey';
  if (el.shape === 'layer-stack') return 'layer-stack';
  if (el.shape === 'pyramid' && el.pyramidVariant !== 'funnel') return 'pyramid';
  if (el.shape === 'pyramid' && el.pyramidVariant === 'funnel') return 'funnel';
  if (el.shape === 'cycle') return 'cycle';
  if (el.shape === 'hub') return 'hub';
  if (el.shape === 'onion') return 'onion';
  if (el.shape === 'chevrons') return 'chevrons';
  if (el.shape === 'timeline-rail') return 'timeline';
  if (el.shape === 'mind-node' && el.mindLook !== 'person') return 'mind-node';
  if (el.shape === 'mind-node' && el.mindLook === 'person') return 'org-chart';
  if (el.shape === 'sequence') return 'sequence';
  if (isChartShape(el.shape)) return 'chart';
  if (el.shape === 'stack') return 'stack';
  if (el.shape === 'entity') return 'entity';
  if (el.shape === 'tab-window') return 'tab-window';
  if (el.shape === 'lane') return 'lane';
  if (el.shape === 'boundary') return 'boundary';
  if (el.shape === 'diagram-key') return 'diagram-key';
  if (el.shape === 'portal') return 'portal';
  // Last: a step guard that fails narrows the element to nothing for any check after it.
  if (isFlowchartStep(el)) return 'flowchart';
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
    // (docs/specs/009-elements/concept-graphics.md "Share roles"); so are a chart's data, a stack's arrangement, an
    // entity's fields, the tab a window shows, a lane's gutter, a boundary's style, a key's meanings and a portal's link.
    case 'layer-stack':
    case 'portal':
    case 'diagram-key':
    case 'boundary':
    case 'lane':
    case 'tab-window':
    case 'entity':
    case 'stack':
    case 'chart':
    case 'chevrons':
    case 'timeline':
    case 'onion':
    case 'hub':
    case 'cycle':
    case 'funnel':
    case 'pyramid':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
    case 'mind-node':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
    case 'flowchart':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
    case 'org-chart':
      return can.level === 'edit' && (el as { locked?: boolean }).locked !== true;
    case 'sequence':
      return canEditSequence(can, el);
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
