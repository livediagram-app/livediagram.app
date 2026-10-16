// The steps every concept graphic's element tour is built from (docs/specs/007-editor/element-tours.md, one section per
// kind; docs/specs/009-elements/concept-graphics.md): a step on the graphic or one of its rows (with an animation
// previewed there, never stored), the "+" ring opened on the add it offers, the More button, and the closing card.
// Each kind's own steps and words live in its own file (layer-stack-tour-steps.ts, ...).
import type { ConceptRow } from '@livediagram/document';
import type { TourPreviewAnim } from '@/lib/concept-tour-preview';
import type { ElementTourApi } from './element-tour-api';
import { waitForSelector } from './tour-dom';
import type { TourStepOf } from './tour-step';

type Step = TourStepOf<ElementTourApi>;

// What a concept tour knows of its graphic when Play is pressed.
export type ConceptTourContext = {
  elementId: string;
  rows: readonly ConceptRow[];
  hasMore: boolean;
  touch: boolean;
};

// The selector of the toured graphic, or of one of its parts.
export function inElement(elementId: string, part = ''): string {
  return `[data-element-id="${escapeId(elementId)}"]${part ? ` ${part}` : ''}`;
}

// An id made safe for an attribute selector.
export function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
}

// The "+" sides, nearest the reader's eye first: the ring under a graphic is where a new row lands.
const PLUS_SIDES = ['below', 'right', 'above', 'left'] as const;

const ringOpen = () =>
  document.querySelector<HTMLElement>('[data-quick-plus][aria-expanded="true"]');

// The step on the "+" ring: opens the first "+" on screen, rings its add option, and closes the ring on leaving.
export function addRowStep(id: string, title: string, body: string, action: string): Step {
  return {
    id,
    title,
    body,
    selector: () => `[data-quick-ring] button[aria-label="${action}"]`,
    prepare: async (api) => {
      api.clearPreview();
      if (ringOpen()) return;
      for (const side of PLUS_SIDES) {
        const plus = document.querySelector<HTMLElement>(`[data-quick-plus="${side}"]`);
        if (plus && plus.getClientRects().length > 0) {
          plus.click();
          break;
        }
      }
      await waitForSelector(`[data-quick-ring] button[aria-label="${action}"]`, 1500);
    },
    cleanup: () => ringOpen()?.click(),
  };
}

// A step on the graphic, or on one of its parts; `preview` plays its animation there while the step is up.
export function onGraphic(
  id: string,
  title: string,
  body: string,
  selector: string,
  preview?: TourPreviewAnim,
): Step {
  return {
    id,
    title,
    body,
    selector: () => selector,
    prepare: (api) => {
      if (preview) api.previewConcept(preview);
      else api.clearPreview();
    },
    cleanup: (api) => api.clearPreview(),
  };
}

// The step on the More button, left out where it is not shown (a power user on a desktop right-clicks instead).
export function inTheMenu(id: string, title: string, body: string): Step {
  return onGraphic(id, title, body, '#selection-more-actions');
}

// The closing card.
export function conceptOutro(title: string, body: string): Step {
  return { id: 'outro', card: 'outro', title, body };
}
