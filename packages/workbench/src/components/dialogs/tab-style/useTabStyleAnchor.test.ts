// @vitest-environment jsdom
// Where the Tab Style popover sits (liveworkspace/docs/specs/011-workbench/tab-style.md "Placement").
import { afterEach, describe, expect, it } from 'vitest';
import { tabStyleAnchor } from './useTabStyleAnchor';

afterEach(() => {
  document.body.innerHTML = '';
});

function box(attr: [string, string], rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('button');
  el.setAttribute(...attr);
  el.getBoundingClientRect = () => ({ width: 44, ...rect }) as DOMRect;
  document.body.appendChild(el);
  return el;
}
const brush = (rect: Partial<DOMRect>) => box(['data-tour-id', 'canvas-theme'], rect);
const cluster = (rect: Partial<DOMRect>) => box(['data-zoom-cluster', ''], rect);
const screenOf = (innerWidth: number, innerHeight = 900) =>
  Object.assign(window, { innerWidth, innerHeight });

describe('tabStyleAnchor', () => {
  it('is none on a phone, whatever is on screen', () => {
    screenOf(600);
    brush({ right: 580, top: 800 });
    expect(tabStyleAnchor()).toBeNull();
  });

  it('hangs below the opener, right edges aligned', () => {
    screenOf(1440);
    const opener = box(['data-opener', ''], { right: 1000, bottom: 120 });
    expect(tabStyleAnchor(() => opener)).toEqual({ right: 440, top: 128 });
  });

  it('rises from the brush when the opener is gone or hidden', () => {
    screenOf(1440);
    brush({ right: 1404, top: 840 });
    expect(tabStyleAnchor(() => null)).toEqual({ right: 36, bottom: 68 });
    const hidden = box(['data-opener', ''], { width: 0, right: 0, bottom: 0 });
    expect(tabStyleAnchor(() => hidden)).toEqual({ right: 36, bottom: 68 });
  });

  it("takes the cluster's right edge when it ends further right, never closer than 8 px to the window's", () => {
    screenOf(1440);
    brush({ right: 1404, top: 840 });
    cluster({ right: 1436 });
    expect(tabStyleAnchor()).toEqual({ right: 8, bottom: 68 });
  });

  it("keeps the brush's edge beside a hidden cluster", () => {
    screenOf(1440);
    brush({ right: 1404, top: 840 });
    cluster({ width: 0, right: 0 });
    expect(tabStyleAnchor()).toEqual({ right: 36, bottom: 68 });
  });

  it('is none without a brush, or a hidden one', () => {
    screenOf(1440);
    expect(tabStyleAnchor()).toBeNull();
    brush({ width: 0 });
    expect(tabStyleAnchor()).toBeNull();
  });
});
