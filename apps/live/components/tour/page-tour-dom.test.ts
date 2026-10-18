// @vitest-environment jsdom
// The page tour's DOM (docs/specs/007-editor/pages-tour.md "The steps"): a popover opened once per step by its
// real button and closed only if the step opened it, and the + the Add step points at.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADD_PAGE_PRESS,
  addPageAnchor,
  BACKGROUND_CHOICES,
  closeTitlePopover,
  layoutAnchor,
  layoutTiles,
  openLayouts,
  openTitlePopover,
  resetPageTour,
} from './page-tour-dom';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

afterEach(() => {
  document.body.innerHTML = '';
  resetPageTour();
});

function place(html: string, rect?: [number, number, number, number]): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  const el = host.firstElementChild as HTMLElement;
  if (rect) {
    const [left, top, width, height] = rect;
    el.getBoundingClientRect = () =>
      ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
  }
  document.body.append(el);
  return el;
}

describe('addPageAnchor', () => {
  it('points at the + after the last page while it is in the window', () => {
    place('<button data-tour-id="add-page"></button>', [600, 300, 36, 36]);
    place('<button data-tour-id="add-page-strip"></button>', [900, 80, 36, 36]);
    expect(addPageAnchor()).toBe('[data-tour-id="add-page"]');
  });

  it('falls back to the Toolbar strip’s + when that one is off screen', () => {
    place('<button data-tour-id="add-page"></button>', [5000, 300, 36, 36]);
    place('<button data-tour-id="add-page-strip"></button>', [900, 80, 36, 36]);
    expect(addPageAnchor()).toBe('[data-tour-id="add-page-strip"]');
  });

  it('has none when neither is in the window (a phone)', () => {
    place('<button data-tour-id="add-page"></button>', [5000, 300, 36, 36]);
    expect(addPageAnchor()).toBeNull();
  });
});

describe('title popovers', () => {
  const page = () => {
    place(
      '<div data-page-id="p1"><button aria-label="Layout" aria-expanded="false"></button></div>',
    );
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Layout"]')!;
    const click = vi.fn(() =>
      button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')),
    );
    button.addEventListener('click', click);
    return { button, click };
  };

  it('opens once per step, so a pick that closed it is not undone', async () => {
    const { button, click } = page();
    await openTitlePopover('p1', 'Layout');
    expect(click).toHaveBeenCalledTimes(1);
    button.setAttribute('aria-expanded', 'false'); // a pick closed it
    await openTitlePopover('p1', 'Layout');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('closes what it opened, and never one it did not open', async () => {
    const { button, click } = page();
    closeTitlePopover('p1', 'Layout');
    expect(click).not.toHaveBeenCalled();
    await openTitlePopover('p1', 'Layout');
    closeTitlePopover('p1', 'Layout');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(click).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/007-editor/coach-dock.md "Teach what is on screen".
describe('the layout step', () => {
  const titleBar = () => {
    const sheet = place('<div data-page-id="p1"></div>');
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Layout');
    button.setAttribute('aria-expanded', 'false');
    const clicks = vi.fn();
    button.addEventListener('click', clicks);
    sheet.append(button);
    return clicks;
  };

  it('points at the page’s own Start From a Layout card and opens nothing while it shows', async () => {
    const clicks = titleBar();
    place('<div data-empty-page-layouts="p1"></div>');
    expect(layoutAnchor('p1')).toBe('[data-empty-page-layouts="p1"]');
    await openLayouts('p1');
    expect(clicks).not.toHaveBeenCalled();
    // The card goes with a pick: a heal of the step never opens the popover behind it.
    document.querySelector('[data-empty-page-layouts]')!.remove();
    await openLayouts('p1');
    expect(clicks).not.toHaveBeenCalled();
    expect(layoutAnchor('p1')).toBe('[data-page-id="p1"] button[aria-label="Layout"]');
  });

  it('opens the Layout popover by its button when the page shows no card', async () => {
    const clicks = titleBar();
    await openLayouts('p1');
    expect(clicks).toHaveBeenCalledTimes(1);
  });
});

describe('Try it presses', () => {
  it('a layout tile on the page’s card or in the Layout popover', () => {
    place('<div data-empty-page-layouts="p1"><button data-layout-tile="a"></button></div>');
    place(
      '<div role="dialog" aria-label="Layout" data-anchored-popover=""><button data-layout-tile="b"></button></div>',
    );
    place('<div data-empty-page-layouts="p2"><button data-layout-tile="c"></button></div>');
    const tiles = [...document.querySelectorAll(layoutTiles('p1'))].map(
      (t) => (t as HTMLElement).dataset.layoutTile,
    );
    expect(tiles).toEqual(['a', 'b']);
  });

  it('a choice in a Background group, and either +', () => {
    place(
      '<div role="dialog" aria-label="Background" data-bottom-sheet=""><div role="radiogroup"><button id="swatch"></button></div><button id="tab"></button></div>',
    );
    expect(document.querySelector(BACKGROUND_CHOICES)?.id).toBe('swatch');
    expect(document.querySelectorAll(`#tab:is(${BACKGROUND_CHOICES})`)).toHaveLength(0);
    place('<button data-tour-id="add-page-strip"></button>');
    expect(document.querySelector(ADD_PAGE_PRESS)).not.toBeNull();
  });
});
