import type { ElementTourKind } from './element-tours';
import { createElementKeyedStore } from './element-keyed-store';

// The element tour offer on screen (docs/specs/007-editor/element-tours.md "The tour offer"): ElementTourHost decides
// whether the selected element is offered its tour and publishes it here; the selection toolbar, which lives in the
// canvas, reads it and draws the offer beside itself.

export type ElementTourOffer = {
  elementId: string;
  kind: ElementTourKind;
  play: () => void;
  dismiss: () => void;
};

const store = createElementKeyedStore<ElementTourOffer>();

export const setElementTourOffer = store.set;
export const elementTourOffer = store.get;

/** The offer, when it is for this element; null otherwise (so other selections never re-render for it). */
export const useElementTourOffer = store.use;
