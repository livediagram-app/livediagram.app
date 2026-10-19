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
} from '@livediagram/document';
import type { ElementTourKind } from '@/lib/element-tours';
import type { HelpArticleKey } from '@/lib/help-articles';
import { layerStackTourSteps } from './layer-stack-tour-steps';
import { pyramidTourSteps } from './pyramid-tour-steps';
import { funnelTourSteps } from './funnel-tour-steps';
import { cycleTourSteps } from './cycle-tour-steps';
import { hubTourSteps } from './hub-tour-steps';
import { onionTourSteps } from './onion-tour-steps';
import { timelineTourSteps } from './timeline-tour-steps';
import { chevronsTourSteps } from './chevrons-tour-steps';
import { mindNodeTourSteps } from './mind-node-tour-steps';
import { flowchartTourSteps } from './flowchart-tour-steps';
import { orgChartTourSteps } from './org-chart-tour-steps';
import { sequenceTourSteps } from './sequence-tour-steps';
import { chartTourSteps } from './chart-tour-steps';
import { stackTourSteps } from './stack-tour-steps';
import { entityTourSteps } from './entity-tour-steps';
import { tabWindowTourSteps } from './tab-window-tour-steps';
import { laneTourSteps } from './lane-tour-steps';
import { boundaryTourSteps } from './boundary-tour-steps';
import { diagramKeyTourSteps } from './diagram-key-tour-steps';
import { portalTourSteps } from './portal-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import {
  sankeyElementTourSteps,
  sankeyFlowsContextOf,
  sankeyTourParts,
} from './sankey-element-tour-steps';
import { stepTelemetryType, type TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

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

// Whether a part of the element is on screen when Play is pressed (a tab window's Open button, a linked portal's).
const inDom = (selector: string) =>
  typeof document !== 'undefined' && document.querySelector(selector) !== null;

export const ELEMENT_TOUR_DEFS: Record<ElementTourKind, ElementTourDef> = {
  sankey: {
    token: 'SankeyTour',
    eyebrow: 'Sankey tour',
    helpArticle: 'sankeyDiagram',
    steps: (el, env) =>
      sankeyElementTourSteps({
        elementId: el.id,
        ...sankeyTourParts(el as ShapeElement),
        hasMore: env.hasMore,
        touch: env.touch,
        flows: sankeyFlowsContextOf(el as ShapeElement),
      }),
    onDone: (api) => api.closeFlows(),
  },
  'layer-stack': {
    token: 'LayerStackTour',
    eyebrow: 'Layer stack tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => layerStackTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  pyramid: {
    token: 'PyramidTour',
    eyebrow: 'Pyramid tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) =>
      pyramidTourSteps({
        elementId: el.id,
        rows: conceptRows(el),
        inverted: (el as ShapeElement).pyramidVariant === 'inverted',
        ...env,
      }),
  },
  funnel: {
    token: 'FunnelTour',
    eyebrow: 'Funnel tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => funnelTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  cycle: {
    token: 'CycleTour',
    eyebrow: 'Cycle tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => cycleTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  hub: {
    token: 'HubTour',
    eyebrow: 'Hub and spoke tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => hubTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  onion: {
    token: 'OnionTour',
    eyebrow: 'Onion tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => onionTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  chevrons: {
    token: 'ChevronsTour',
    eyebrow: 'Chevrons tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => chevronsTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  timeline: {
    token: 'TimelineTour',
    eyebrow: 'Timeline tour',
    helpArticle: 'conceptGraphics',
    steps: (el, env) => timelineTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  'mind-node': {
    token: 'MindMapTour',
    eyebrow: 'Mind map tour',
    helpArticle: 'mindMaps',
    steps: (el, env) =>
      mindNodeTourSteps({
        elementId: el.id,
        hasChildren: env.elements.some((e) => (e as ShapeElement).mindParentId === el.id),
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  flowchart: {
    token: 'FlowchartTour',
    eyebrow: 'Flowchart tour',
    helpArticle: 'flowcharts',
    steps: (el, env) =>
      flowchartTourSteps({
        elementId: el.id,
        hasLanes: env.elements.some(
          (e) =>
            e.type === 'shape' &&
            e.shape === 'lane' &&
            e.flowchartId === (el as ShapeElement).flowchartId,
        ),
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  'org-chart': {
    token: 'OrgChartTour',
    eyebrow: 'Org chart tour',
    helpArticle: 'orgCharts',
    steps: (el, env) =>
      orgChartTourSteps({
        elementId: el.id,
        hasReports: env.elements.some((e) => (e as ShapeElement).mindParentId === el.id),
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  sequence: {
    token: 'SequenceTour',
    eyebrow: 'Sequence tour',
    helpArticle: 'sequenceDiagram',
    steps: (el, env) =>
      sequenceTourSteps({
        elementId: el.id,
        hasMessages: ((el as ShapeElement).sequenceMessages ?? []).length > 0,
        hasMore: env.hasMore,
        touch: env.touch,
      }),
    onDone: (api) => api.closeSequence(),
  },
  chart: {
    token: 'ChartTour',
    eyebrow: 'Chart tour',
    helpArticle: 'dataElements',
    steps: (el, env) =>
      chartTourSteps({
        elementId: el.id,
        type: chartTypeOf(el as ShapeElement) ?? 'column',
        fromSheet: !!(el as ShapeElement).chartSource,
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
  entity: {
    token: 'EntityTour',
    eyebrow: 'Entity tour',
    helpArticle: 'entities',
    steps: (el, env) =>
      entityTourSteps({
        elementId: el.id,
        hasFields: ((el as ShapeElement).entityFields ?? []).length > 0,
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
  'tab-window': {
    token: 'TabWindowTour',
    eyebrow: 'Tab window tour',
    helpArticle: 'tabWindows',
    steps: (el, env) =>
      tabWindowTourSteps({
        elementId: el.id,
        chosen: inDom(elementSelector(el.id, '[data-tab-window-open]')),
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
