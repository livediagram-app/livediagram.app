// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { pagesOnScreen } from './usePageDesignViews';

// A sheet at a left edge (px), 400 wide and 300 tall, at the top of the window.
function sheet(id: string, left: number): HTMLElement {
  const el = document.createElement('div');
  el.dataset.pageId = id;
  el.getBoundingClientRect = () =>
    ({ left, right: left + 400, top: 0, bottom: 300, width: 400, height: 300 }) as DOMRect;
  document.body.append(el);
  return el;
}

describe('the pages on screen during a Fine Tune gesture', () => {
  afterEach(() => document.body.replaceChildren());

  it('names the sheets in the window or within the margin, and none past it', () => {
    const w = window.innerWidth;
    sheet('in', 10);
    sheet('near', w + 100);
    sheet('far', w + 1000);
    sheet('left', -900);
    expect([...pagesOnScreen(200)].sort()).toEqual(['in', 'near']);
  });
});
