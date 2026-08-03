// One definition of "which `Element·Added` type is this element" (spec/22).
//
// Creation paths that build an element from scratch each derive this token
// inline from the thing they're about to build (a draw intent, a palette
// pick). The paths that copy an EXISTING element — duplicate, paste,
// shift-drag — have no intent to read, only the element itself, and there
// are five of them. Hence one shared mapper rather than five near-copies
// that would drift the moment a new element kind lands.
//
// The tokens must match what the from-scratch paths emit, or the same
// element splits across two dashboard rows: `CodeBlock` (not the
// title-cased `Code-Block`), `TechIcon` for a brand mark, `Highlighter`
// for the highlighter pen.

import type { ComponentKind, Element } from '@livediagram/diagram';
import { isTechIconId } from '@/lib/tech-icons';
import { titleCaseType, track } from '@/lib/telemetry';

// Telemetry for a copy gesture — duplicate, paste, shift-drag (spec/22).
//
// Two events, deliberately, because they answer two different questions:
//
// - ONE `Element·Duplicated` per gesture: "how often do people copy?"
// - ONE `Element·Added·<kind>` per element created: "what is on people's
//   canvases?"
//
// Copy paths used to emit only the first, so duplicating twelve shapes
// logged a single untyped event and `Element·Added` — the census behind
// the dashboard's Palette ranking — never saw twelve squares at all. Any
// element born by copying was invisible to it, which under-counted exactly
// the shapes people like enough to reuse.
//
// Called AFTER the copies are built, never before: the copy paths have
// guards that can still bail (nothing copyable in the selection, a
// degenerate paste), and emitting up front logged duplicates that never
// happened. An empty list emits nothing at all.
// `gestureType` names the gesture when there's more than one way to copy
// (shift-drag vs the menu), and is left off when there isn't. It goes on
// the single Duplicated event, never on the per-element Added ones — those
// have to stay comparable with the from-scratch creation paths.
export function trackDuplicated(created: Element[], gestureType?: string): void {
  if (created.length === 0) return;
  track('Element', 'Duplicated', gestureType);
  for (const element of created) track('Element', 'Added', elementTelemetryType(element));
}

// Hyphenated shape kinds whose token is spelled out rather than left to
// titleCaseType, which only upper-cases the first character: 'code-block'
// would report as 'Code-block' while every other event for that feature says
// 'CodeBlock', splitting one feature across two tokens on the dashboard.
//
// Four of these were missing and the events really were going nowhere: a
// session button, reaction pad, comment pin or done check reported as
// 'Session-button' and friends on Added, while its own Changed events and the
// dashboard's PALETTE_TELEMETRY_TYPES both said 'SessionButton'. The Added
// count for four features sat at zero.
//
// Not every hyphenated kind belongs here. 'roll-call' reports as 'Roll-call'
// deliberately, and the catalogue agrees; this map is for kinds whose OTHER
// events already chose the camel-case spelling.
const SHAPE_TOKENS: Record<string, string> = {
  'code-block': 'CodeBlock',
  'mode-button': 'ModeButton',
  'mind-node': 'MindNode',
  'session-button': 'SessionButton',
  'reaction-pad': 'ReactionPad',
  'comment-pin': 'CommentPin',
  'done-check': 'DoneCheck',
};

export function elementTelemetryType(element: Element): string {
  switch (element.type) {
    case 'arrow':
      return 'Arrow';
    case 'text':
      return 'Text';
    case 'sticky':
      return 'Sticky';
    case 'image':
      return 'Image';
    case 'table':
      return 'Table';
    case 'link-card':
      return 'LinkCard';
    case 'video':
      return 'Video';
    case 'annotation':
      return 'Annotation';
    case 'freehand':
      // Three tools share this element kind and the draw paths report them
      // separately, so a copy must too. `pen` marks the highlighter and
      // `straightEdges` the polygon tool (spec/84); a plain pencil stroke
      // has neither.
      if (element.pen === 'highlighter') return 'Highlighter';
      if (element.straightEdges) return element.closed ? 'Polygon' : 'Polyline';
      return 'Freehand';
    case 'shape': {
      // A brand mark reports as TechIcon rather than by its shape, matching
      // both the click-to-add and drag-to-draw paths.
      if (element.iconId && isTechIconId(element.iconId)) return 'TechIcon';
      return SHAPE_TOKENS[element.shape] ?? titleCaseType(element.shape);
    }
  }
}

// The composites (spec/09) drop as a GROUP, not as one element, so they never
// reach elementTelemetryType — their add is reported straight from the draw
// path. The token lives here anyway, beside the element one, because it
// answers the same question and belongs to the same vocabulary: keeping it in
// the drawing hook is how `Video` came to be missing from the dashboard
// catalogue, unseen by the test that walks this file.
export const COMPONENT_TELEMETRY: Record<ComponentKind, string> = {
  banner: 'Banner',
  hero: 'Hero',
  header: 'Header',
  callout: 'Callout',
  stat: 'StatRow',
  process: 'ProcessSteps',
  avatar: 'Avatar',
};

export function componentTelemetryType(kind: ComponentKind): string {
  return COMPONENT_TELEMETRY[kind];
}
