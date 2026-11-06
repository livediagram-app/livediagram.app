// @vitest-environment jsdom

// The Portal tour (docs/specs/007-editor/element-tours.md "The Portal tour") on its element's own parts, and the menu
// step every element tour shares.

import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { ELEMENT_TOUR_DEFS } from './element-tour-defs';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import { portalTourSteps } from './portal-tour-steps';
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';

const env: MenuTourEnv = { elementId: 'el', hasMore: true, touch: false };
type Step = TourStepOf<ElementTourApi>;
const ids = (steps: Step[]) => steps.map((s) => s.id);
const step = (steps: Step[], id: string) => steps.find((s) => s.id === id)!;
const ringed = (s: Step) => s.selector!({} as ElementTourApi);

describe('menuStep', () => {
  it('opens the menu to its path and rings it, saying how to get there', () => {
    const more = menuStep(env, 'menu', 'Menu', 'Tools, then Portal.', ['Tools', 'Portal']);
    expect(ringed(more)).toBe('[data-tour-menu-target]');
    expect(more.body).toBe('More, then Tools, then Portal.');
    const right = menuStep({ ...env, hasMore: false }, 'menu', 'Menu', 'Tools, then Portal.', [
      'Tools',
      'Portal',
    ]);
    expect(ringed(right)).toBe('[data-tour-menu-target]');
    expect(right.body).toBe('Right-click it, then Tools, then Portal.');
  });
});

describe('portalTourSteps', () => {
  it('steps through a linked portal, and explains a dim one', () => {
    expect(ids(portalTourSteps({ ...env, linked: true }))).toEqual([
      'portal',
      'travel',
      'menu',
      'walk',
      'outro',
    ]);
    const dim = portalTourSteps({ ...env, linked: false, touch: true });
    expect(ids(dim)).toContain('unlinked');
    expect(step(dim, 'menu').body).toContain('Create Portal');
  });
});

describe('the registry reads what is on screen when Play is pressed', () => {
  const env2 = (el: Element) => ({ hasMore: true, touch: false, elements: [el] });

  it('steps through a portal only when it is lit', () => {
    const portal = { ...createShape('portal', 0, 0), id: 'p1' } as Element;
    expect(ids(ELEMENT_TOUR_DEFS.portal.steps(portal, env2(portal)))).toContain('unlinked');
    document.body.innerHTML =
      '<div data-element-id="p1"><button aria-label="Portal 1: go to Portal 2"></button></div>';
    expect(ids(ELEMENT_TOUR_DEFS.portal.steps(portal, env2(portal)))).toContain('travel');
    document.body.innerHTML = '';
  });
});
