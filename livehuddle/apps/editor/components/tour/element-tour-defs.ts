// The element tours, one definition per toured kind (docs/specs/007-editor/element-tours.md "Adding an element tour"):
// its steps on the selected element, its closing card's eyebrow and help link, its telemetry token, and what it puts
// away on Done. ElementTourHost runs whichever the selected element's kind names; this module is loaded with it, so
// none of it is in the editor's first load.
import type { Element } from '@livehuddle/document';
import type { ElementTourKind } from '@/lib/element-tours';
import type { HelpArticleKey } from '@/lib/help-articles';
import { portalTourSteps } from './portal-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import {
  stepTelemetryType,
  type TourStepOf,
} from '@liveworkspace/workbench/components/tour/tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// What the steps may know about where the tour runs, read when Play is pressed.
type ElementTourEnv = {
  // The selection toolbar's More button is showing; the menu steps say "Right-click it" where it is not.
  hasMore: boolean;
  // A touch screen: taps where a mouse clicks.
  touch: boolean;
  // The tab's elements, for a tour that reads past its own element.
  elements: readonly Element[];
};

type ElementTourDef = {
  // The telemetry token, `<Kind>Tour` (docs/specs/017-telemetry/telemetry.md): Started, Ended …Completed / …Skipped,
  // the offer's Opened / Closed …Offer, and each step's View …Step<Id>.
  token: string;
  // The closing card's eyebrow ("Portal tour").
  eyebrow: string;
  helpArticle: HelpArticleKey;
  steps: (el: Element, env: ElementTourEnv) => TourStepOf<ElementTourApi>[];
  // Puts away what the tour opened, on Done (a Skip leaves the person where they are).
  onDone?: (api: ElementTourApi) => void;
};

// Whether a part of the element is on screen when Play is pressed (a linked portal's Open button).
const inDom = (selector: string) =>
  typeof document !== 'undefined' && document.querySelector(selector) !== null;

export const ELEMENT_TOUR_DEFS: Record<ElementTourKind, ElementTourDef> = {
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

// The step-view token: ('PortalTour', 'walk') → 'PortalTourStepWalk'.
export function elementTourStepTelemetryType(def: ElementTourDef, stepId: string): string {
  return stepTelemetryType(`${def.token}Step`, stepId);
}
