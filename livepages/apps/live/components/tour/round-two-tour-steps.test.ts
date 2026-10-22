// @vitest-environment jsdom

// The round-two element tours (docs/specs/007-editor/element-tours.md): the stack, entity, tab window, lane, boundary,
// diagram key and portal tours, each on its element's own parts, and the menu step they share.

import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livepages/document';
import { boundaryTourSteps } from './boundary-tour-steps';
import { diagramKeyTourSteps } from './diagram-key-tour-steps';
import { ELEMENT_TOUR_DEFS } from './element-tour-defs';
import type { ElementTourApi } from './element-tour-api';
import { entityTourSteps } from './entity-tour-steps';
import { laneTourSteps } from './lane-tour-steps';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import { portalTourSteps } from './portal-tour-steps';
import { stackTourSteps } from './stack-tour-steps';
import { tabWindowTourSteps } from './tab-window-tour-steps';
import type { TourStepOf } from './tour-step';

const env: MenuTourEnv = { elementId: 'el', hasMore: true, touch: false };
type Step = TourStepOf<ElementTourApi>;
const ids = (steps: Step[]) => steps.map((s) => s.id);
const step = (steps: Step[], id: string) => steps.find((s) => s.id === id)!;
const ringed = (s: Step) => s.selector!({} as ElementTourApi);

describe('menuStep', () => {
  it('opens the menu to its path and rings it, saying how to get there', () => {
    const more = menuStep(env, 'menu', 'Menu', 'Tools, then Stack.', ['Tools', 'Stack']);
    expect(ringed(more)).toBe('[data-tour-menu-target]');
    expect(more.body).toBe('More, then Tools, then Stack.');
    const right = menuStep({ ...env, hasMore: false }, 'menu', 'Menu', 'Tools, then Stack.', [
      'Tools',
      'Stack',
    ]);
    expect(ringed(right)).toBe('[data-tour-menu-target]');
    expect(right.body).toBe('Right-click it, then Tools, then Stack.');
  });
});

describe('stackTourSteps', () => {
  it('rings its first child for a reorder, and asks for a drop on an empty stack', () => {
    const full = stackTourSteps({ ...env, direction: 'grid', firstChildId: 'kid' });
    expect(ids(full)).toEqual(['stack', 'child', 'carry', 'menu', 'outro']);
    expect(ringed(step(full, 'child'))).toBe('[data-element-id="kid"]');
    expect(full[0]!.body).toContain('in a grid');
    const empty = stackTourSteps({ ...env, direction: 'row', firstChildId: null });
    expect(ids(empty)).toEqual(['stack', 'drop', 'carry', 'menu', 'outro']);
  });
});

describe('entityTourSteps', () => {
  it('rings its fields when it has some, and always names the Fields menu', () => {
    const steps = entityTourSteps({ ...env, hasFields: true });
    expect(ids(steps)).toEqual(['entity', 'title', 'rows', 'menu', 'relate', 'outro']);
    expect(ringed(step(steps, 'rows'))).toBe('[data-element-id="el"] [data-entity-fields]');
    expect(step(steps, 'menu').body).toContain('Fields');
    expect(ids(entityTourSteps({ ...env, hasFields: false }))).not.toContain('rows');
    expect(step(entityTourSteps({ ...env, touch: true, hasFields: false }), 'title').body).toMatch(
      /^Double-tap/,
    );
  });
});

describe('tabWindowTourSteps', () => {
  it('rings Open on a window showing a tab, and Choose a Tab on one that is not', () => {
    const shown = tabWindowTourSteps({ ...env, chosen: true });
    expect(ids(shown)).toEqual(['window', 'open', 'menu', 'size', 'outro']);
    expect(ringed(step(shown, 'open'))).toBe('[data-element-id="el"] [data-tab-window-open]');
    const empty = tabWindowTourSteps({ ...env, chosen: false });
    expect(ids(empty)).toEqual(['window', 'choose', 'menu', 'size', 'outro']);
    expect(ringed(step(empty, 'choose'))).toBe('[data-element-id="el"] [data-tab-window-choose]');
  });
});

describe('laneTourSteps', () => {
  it('rings the gutter and its seam', () => {
    const steps = laneTourSteps(env);
    expect(ids(steps)).toEqual(['lane', 'gutter', 'seam', 'carry', 'menu', 'outro']);
    expect(ringed(step(steps, 'gutter'))).toBe('[data-element-id="el"] [data-lane-gutter]');
    expect(ringed(step(steps, 'seam'))).toBe('[data-element-id="el"] [data-lane-seam]');
    expect(step(steps, 'menu').body).toMatch(/^More, then Text/);
  });
});

describe('boundaryTourSteps', () => {
  it('rings the meta line it shows, and speaks of icons only where its style draws one', () => {
    const steps = boundaryTourSteps({ ...env, style: 'tab', hasMeta: true });
    expect(ids(steps)).toEqual(['zone', 'title', 'meta', 'menu', 'outro']);
    expect(ringed(step(steps, 'meta'))).toBe(
      '[data-element-id="el"] [aria-label="Boundary meta line"]',
    );
    expect(step(steps, 'title').body).toContain('icon');
    const c4 = boundaryTourSteps({ ...env, style: 'c4', hasMeta: false });
    expect(ids(c4)).not.toContain('meta');
    // C4 draws no icon before the title, so its step does not offer one.
    expect(step(c4, 'title').body).not.toContain('icon');
  });
});

describe('diagramKeyTourSteps', () => {
  it('rings its first row, or says what brings rows to an empty key, with no menu step', () => {
    const steps = diagramKeyTourSteps({ elementId: 'el', touch: false, firstRowId: 'line:dashed' });
    expect(ids(steps)).toEqual(['key', 'meaning', 'title', 'outro']);
    expect(ringed(step(steps, 'meaning'))).toBe(
      '[data-element-id="el"] [data-key-meaning="line\\:dashed"]',
    );
    expect(ids(diagramKeyTourSteps({ elementId: 'el', touch: true, firstRowId: null }))).toEqual([
      'key',
      'empty',
      'title',
      'outro',
    ]);
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

  it("rings a tab window's Open button only when it draws one", () => {
    const win = { ...createShape('tab-window', 0, 0), id: 'w1' } as Element;
    expect(ids(ELEMENT_TOUR_DEFS['tab-window'].steps(win, env2(win)))).toContain('choose');
    document.body.innerHTML =
      '<div data-element-id="w1"><button data-tab-window-open></button></div>';
    expect(ids(ELEMENT_TOUR_DEFS['tab-window'].steps(win, env2(win)))).toContain('open');
    document.body.innerHTML = '';
  });

  it('steps through a portal only when it is lit', () => {
    const portal = { ...createShape('portal', 0, 0), id: 'p1' } as Element;
    expect(ids(ELEMENT_TOUR_DEFS.portal.steps(portal, env2(portal)))).toContain('unlinked');
    document.body.innerHTML =
      '<div data-element-id="p1"><button aria-label="Portal 1: go to Portal 2"></button></div>';
    expect(ids(ELEMENT_TOUR_DEFS.portal.steps(portal, env2(portal)))).toContain('travel');
    document.body.innerHTML = '';
  });
});
