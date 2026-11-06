// The steps every element tour is built from (docs/specs/007-editor/element-tours.md): a step on the element or one
// of its parts, a step on its own menu, and the closing card. Each kind's own steps and words live in its own file
// (portal-tour-steps.ts).
import type { ElementTourApi } from './element-tour-api';
import {
  clearMenuPath,
  MENU_TARGET,
  openMenuPath,
} from '@liveworkspace/workbench/components/tour/element-menu-tour';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';

type Step = TourStepOf<ElementTourApi>;

// A step on the element, or on one of its parts.
export function onGraphic(id: string, title: string, body: string, selector: string): Step {
  return { id, title, body, selector: () => selector };
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
