// The steps every concept graphic's element tour is built from (docs/specs/007-editor/element-tours.md, one section per
// kind; docs/specs/009-elements/timeline.md): a step on the graphic or one of its rows (with an animation
// previewed there, never stored), the More button, and the closing card. (livehuddle has no "+" ring to open,
// docs/specs/002-project-scope/not-in-livehuddle.md#quick-connect.)
// Each kind's own steps and words live in its own file (timeline-tour-steps.ts, ...).
import type { ConceptRow } from '@livehuddle/document';
import type { TourPreviewAnim } from '@liveworkspace/workbench/lib/concept-tour-preview';
import type { ElementTourApi } from './element-tour-api';
import {
  clearMenuPath,
  MENU_TARGET,
  openMenuPath,
} from '@liveworkspace/workbench/components/tour/element-menu-tour';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';

type Step = TourStepOf<ElementTourApi>;

// What a concept tour knows of its graphic when Play is pressed.
export type ConceptTourContext = {
  elementId: string;
  rows: readonly ConceptRow[];
  hasMore: boolean;
  touch: boolean;
};

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

// Whether the menu step on screen has been left, so a menu still opening as it ends is closed too.
let menuLeft = false;

// A step on the element's own menu (docs/specs/007-editor/element-tours.md "Menu steps"): it opens the menu and the
// rows of `path` ("Tools", "Rows"), rings the part they open, and closes the menu again on leaving.
export function inTheMenu(id: string, title: string, body: string, path: readonly string[]): Step {
  return {
    id,
    title,
    body,
    selector: () => MENU_TARGET,
    prepare: async (api) => {
      menuLeft = false;
      api.clearPreview();
      await api.openElementMenu();
      await openMenuPath(path);
      // Left while the menu was still opening: it closes as it arrives.
      if (menuLeft) {
        clearMenuPath();
        api.closeElementMenu();
      }
    },
    cleanup: (api) => {
      menuLeft = true;
      clearMenuPath();
      api.closeElementMenu();
    },
  };
}

// The closing card.
export function conceptOutro(title: string, body: string): Step {
  return { id: 'outro', card: 'outro', title, body };
}
