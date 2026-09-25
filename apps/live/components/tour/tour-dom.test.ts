// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clickTour, findTour, waitForTour } from './tour-dom';

// A tour anchor has to be something the user can actually SEE: chrome that
// a surface hides (the event-storming board's palette header, spec/139)
// still sits in the DOM with display:none, and anchoring to it put the
// highlight ring at 0x0 in the top-left corner and clicked a trigger whose
// menu then opened off-screen. jsdom does no layout, so laid-out nodes are
// modelled by stubbing getClientRects (the browser's own "has a box" test).

function anchor(tourId: string, laidOut: boolean): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour-id', tourId);
  el.getClientRects = (() =>
    laidOut
      ? ([{ left: 10, top: 10, width: 100, height: 20 }] as unknown as DOMRectList)
      : ([] as unknown as DOMRectList)) as HTMLElement['getClientRects'];
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tour DOM anchors', () => {
  it('finds an anchor that renders a box', async () => {
    const el = anchor('palette', true);
    expect(findTour('palette')).toBe(el);
    await expect(waitForTour('palette', 50)).resolves.toBe(el);
  });

  it('treats a hidden anchor as absent, so the step is skipped', async () => {
    anchor('canvas-tool', false);
    expect(findTour('canvas-tool')).toBeNull();
    await expect(waitForTour('canvas-tool', 50)).resolves.toBeNull();
  });

  it('refuses to click a hidden anchor', () => {
    const el = anchor('canvas-tool', false);
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    expect(clickTour('canvas-tool')).toBe(false);
    expect(clicks).toBe(0);
  });

  it('clicks a visible anchor', () => {
    const el = anchor('dock-palette', true);
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    expect(clickTour('dock-palette')).toBe(true);
    expect(clicks).toBe(1);
  });

  // The Toolbar layout's Explorer menu button anchors on its card, not the
  // button inside (spec/148); a click on the card alone never opened it.
  it('presses the button inside a wrapping anchor', () => {
    const el = anchor('dock-explorer', true);
    const button = document.createElement('button');
    el.append(button);
    let clicks = 0;
    button.addEventListener('click', () => clicks++);
    expect(clickTour('dock-explorer')).toBe(true);
    expect(clicks).toBe(1);
  });
});
