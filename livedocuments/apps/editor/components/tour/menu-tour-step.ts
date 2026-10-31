import { inTheMenu } from './concept-element-tour-steps';
import type { ElementTourApi } from '@liveworkspace/workbench/components/tour/element-tour-api';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';

// What a round-two element tour knows of where it runs (docs/specs/007-editor/element-tours.md "Menu steps on the
// elements of round two").
export type MenuTourEnv = { elementId: string; touch: boolean };

// The step on an element's own menu section. These elements are edited mostly from there, so the step is kept for
// everyone: it opens the menu to the part `path` names and rings it (inTheMenu). `body` follows the words that say how
// to get there: `Right-click it, then ${body}`, or `Press and hold it, then ${body}` on a touch screen (there is no
// selection toolbar, so no More button, docs/specs/007-editor/element-tours.md).
export function menuStep(
  env: MenuTourEnv,
  id: string,
  title: string,
  body: string,
  path: readonly string[],
): TourStepOf<ElementTourApi> {
  return inTheMenu(
    id,
    title,
    `${env.touch ? 'Press and hold it' : 'Right-click it'}, then ${body}`,
    path,
  );
}

// "Click" or "Tap", as the screen is pressed.
export const pressWord = (env: Pick<MenuTourEnv, 'touch'>) => (env.touch ? 'Tap' : 'Click');
