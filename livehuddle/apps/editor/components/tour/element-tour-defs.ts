// The element tours, one definition per toured kind (docs/specs/007-editor/element-tours.md "Adding an element tour"):
// its steps on the selected element, its closing card's eyebrow and help link, its telemetry token, and what it puts
// away on Done. ElementTourHost runs whichever the selected element's kind names; this module is loaded with it, so
// none of it is in the editor's first load.
import {
  boundaryStyleOf,
  chartTypeOf,
  stackChildren,
  stackSettingsOf,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import type { ElementTourKind } from '@/lib/element-tours';
import type { HelpArticleKey } from '@/lib/help-articles';
import { timelineTourSteps } from './timeline-tour-steps';
import { chartTourSteps } from './chart-tour-steps';
import { stackTourSteps } from './stack-tour-steps';
import { laneTourSteps } from './lane-tour-steps';
import { boundaryTourSteps } from './boundary-tour-steps';
import { diagramKeyTourSteps } from './diagram-key-tour-steps';
import { portalTourSteps } from './portal-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// What the steps may know about where the tour runs, read when Play is pressed.
type ElementTourEnv = {
  // The selection toolbar's More button is showing (not for a power user on a desktop, who right-clicks).
  hasMore: boolean;
  // A touch screen: taps where a mouse clicks.
  touch: boolean;
  // The tab's elements, for a tour that reads past its own element (a mind node's children).
  elements: readonly Element[];
};

type ElementTourDef = {
  // The telemetry token, `<Kind>Tour` (docs/specs/017-telemetry/telemetry.md): Started, Ended …Completed / …Skipped,
  // the offer's Opened / Closed …Offer, and each step's View …Step<Id>.
  token: string;
  // The closing card's eyebrow ("Sankey tour").
  eyebrow: string;
  helpArticle: HelpArticleKey;
  steps: (el: Element, env: ElementTourEnv) => TourStepOf<ElementTourApi>[];
  // Puts away what the tour opened, on Done (a Skip leaves the person where they are).
  onDone?: (api: ElementTourApi) => void;
};

const conceptRows = (el: Element) => (el as ShapeElement).conceptRows ?? [];

// Whether a part of the element is on screen when Play is pressed (a linked portal's Open button).
const inDom = (selector: string) =>
  typeof document !== 'undefined' && document.querySelector(selector) !== null;

export const ELEMENT_TOUR_DEFS: Record<ElementTourKind, ElementTourDef> = {
  timeline: {
    token: 'TimelineTour',
    eyebrow: 'Timeline tour',
    helpArticle: 'timelineRail',
    steps: (el, env) => timelineTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  chart: {
    token: 'ChartTour',
    eyebrow: 'Chart tour',
    helpArticle: 'dataElements',
    steps: (el, env) =>
      chartTourSteps({
        elementId: el.id,
        type: chartTypeOf(el as ShapeElement) ?? 'column',
        hasMore: env.hasMore,
        touch: env.touch,
      }),
    onDone: (api) => api.closeChartData(),
  },
  stack: {
    token: 'StackTour',
    eyebrow: 'Stack tour',
    helpArticle: 'stacks',
    steps: (el, env) =>
      stackTourSteps({
        elementId: el.id,
        direction: stackSettingsOf(el as ShapeElement).direction,
        firstChildId: stackChildren(env.elements, el as ShapeElement)[0]?.id ?? null,
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  lane: {
    token: 'LaneTour',
    eyebrow: 'Lane tour',
    helpArticle: 'lanes',
    steps: (el, env) => laneTourSteps({ elementId: el.id, hasMore: env.hasMore, touch: env.touch }),
  },
  boundary: {
    token: 'BoundaryTour',
    eyebrow: 'Boundary tour',
    helpArticle: 'boundaries',
    steps: (el, env) =>
      boundaryTourSteps({
        elementId: el.id,
        style: boundaryStyleOf(el as ShapeElement),
        hasMeta: !!(el as ShapeElement).pageSubtitle,
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  'diagram-key': {
    token: 'DiagramKeyTour',
    eyebrow: 'Diagram key tour',
    helpArticle: 'diagramKeys',
    steps: (el, env) =>
      diagramKeyTourSteps({
        elementId: el.id,
        firstRowId: (el as ShapeElement).keyRows?.[0]?.id ?? null,
        touch: env.touch,
      }),
  },
  portal: {
    token: 'PortalTour',
    eyebrow: 'Portal tour',
    helpArticle: 'portals',
    steps: (el, env) =>
      portalTourSteps({
        elementId: el.id,
        linked: inDom(elementSelector(el.id, 'button[aria-label*=": go to"]')),
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
};

// The step-view token: ('SankeyTour', 'flows-add') → 'SankeyTourStepFlowsAdd'.
export function elementTourStepTelemetryType(def: ElementTourDef, stepId: string): string {
  return stepTelemetryType(`${def.token}Step`, stepId);
}
