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

import type { Element } from '@livediagram/diagram';
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
      // titleCaseType would yield 'Code-Block' (it capitalises at the
      // hyphen), which would split the feature across two tokens.
      if (element.shape === 'code-block') return 'CodeBlock';
      return titleCaseType(element.shape);
    }
  }
}
