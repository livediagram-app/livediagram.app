// The element tours, one definition per toured kind (docs/specs/007-editor/element-tours.md "Adding an element tour"):
// its steps on the selected element, its closing card's eyebrow and help link, its telemetry token, and what it puts
// away on Done. ElementTourHost runs whichever the selected element's kind names; this module is loaded with it, so
// none of it is in the editor's first load.
import type { Element, ShapeElement } from '@livediagram/document';
import type { ElementTourKind } from '@/lib/element-tours';
import type { HelpArticleKey } from '@/lib/help-articles';
import { layerStackTourSteps } from './layer-stack-tour-steps';
import { pyramidTourSteps } from './pyramid-tour-steps';
import { funnelTourSteps } from './funnel-tour-steps';
import { cycleTourSteps } from './cycle-tour-steps';
import { hubTourSteps } from './hub-tour-steps';
import { onionTourSteps } from './onion-tour-steps';
import { chevronsTourSteps } from './chevrons-tour-steps';
import { mindNodeTourSteps } from './mind-node-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import {
  sankeyElementTourSteps,
  sankeyFlowsContextOf,
  sankeyTourParts,
} from './sankey-element-tour-steps';
import { stepTelemetryType, type TourStepOf } from './tour-step';

// What the steps may know about where the tour runs, read when Play is pressed.
export type ElementTourEnv = {
  // The selection toolbar's More button is showing (not for a power user on a desktop, who right-clicks).
  hasMore: boolean;
  // A touch screen: taps where a mouse clicks.
  touch: boolean;
  // The tab's elements, for a tour that reads past its own element (a mind node's children).
  elements: readonly Element[];
};

export type ElementTourDef = {
  // The telemetry token, `<Kind>Tour` (docs/specs/017-telemetry/telemetry.md): Started, Ended …Completed / …Skipped,
  // the offer's Opened / Closed …Offer, and each step's View …Step<Id>.
  token: string;
  // The closing card's eyebrow ("Sankey tour").
  eyebrow: string;
  helpArticle: HelpArticleKey;
  helpLabel: string;
  steps: (el: Element, env: ElementTourEnv) => TourStepOf<ElementTourApi>[];
  // Puts away what the tour opened, on Done (a Skip leaves the person where they are).
  onDone?: (api: ElementTourApi) => void;
};

const conceptRows = (el: Element) => (el as ShapeElement).conceptRows ?? [];

export const ELEMENT_TOUR_DEFS: Record<ElementTourKind, ElementTourDef> = {
  sankey: {
    token: 'SankeyTour',
    eyebrow: 'Sankey tour',
    helpArticle: 'sankeyDiagram',
    helpLabel: 'Sankey Diagram Help',
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
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => layerStackTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  pyramid: {
    token: 'PyramidTour',
    eyebrow: 'Pyramid tour',
    helpArticle: 'conceptGraphics',
    helpLabel: 'Concept Graphics Help',
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
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => funnelTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  cycle: {
    token: 'CycleTour',
    eyebrow: 'Cycle tour',
    helpArticle: 'conceptGraphics',
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => cycleTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  hub: {
    token: 'HubTour',
    eyebrow: 'Hub and spoke tour',
    helpArticle: 'conceptGraphics',
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => hubTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  onion: {
    token: 'OnionTour',
    eyebrow: 'Onion tour',
    helpArticle: 'conceptGraphics',
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => onionTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  chevrons: {
    token: 'ChevronsTour',
    eyebrow: 'Chevrons tour',
    helpArticle: 'conceptGraphics',
    helpLabel: 'Concept Graphics Help',
    steps: (el, env) => chevronsTourSteps({ elementId: el.id, rows: conceptRows(el), ...env }),
  },
  'mind-node': {
    token: 'MindMapTour',
    eyebrow: 'Mind map tour',
    helpArticle: 'mindMaps',
    helpLabel: 'Mind Maps Help',
    steps: (el, env) =>
      mindNodeTourSteps({
        elementId: el.id,
        hasChildren: env.elements.some((e) => (e as ShapeElement).mindParentId === el.id),
        hasMore: env.hasMore,
        touch: env.touch,
      }),
  },
};

// The step-view token: ('SankeyTour', 'flows-add') → 'SankeyTourStepFlowsAdd'.
export function elementTourStepTelemetryType(def: ElementTourDef, stepId: string): string {
  return stepTelemetryType(`${def.token}Step`, stepId);
}
