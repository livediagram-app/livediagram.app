// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sideChromeInsets } from './side-chrome-insets';

// docs/specs/007-editor/pages-mode.md "Contents": the sidebar's width is kept clear on its side. The
// measures behind it are @liveworkspace/workbench/lib/contents-sidebar's, tested there.
const canvas = { left: 0, right: 1200, top: 60, bottom: 860 };
const rect = (left: number, right: number) =>
  ({ left, right, top: 130, bottom: 860, width: right - left, height: 730 }) as DOMRect;

describe('sideChromeInsets', () => {
  it('frames beside the resting sidebar, not the one mid-slide', () => {
    const main = document.createElement('main');
    main.getBoundingClientRect = () => ({ ...canvas, width: 1200, height: 800 }) as DOMRect;
    const panel = document.createElement('aside');
    panel.setAttribute('data-contents-sidebar', '');
    panel.style.translate = '640px';
    panel.getBoundingClientRect = () => rect(1604, 1840);
    document.body.append(panel);
    expect(sideChromeInsets(main)).toEqual({ left: 0, right: 236 });
    panel.remove();
    expect(sideChromeInsets(main)).toEqual({ left: 0, right: 0 });
  });

  it('keeps the page tree and the docked page rail both clear', () => {
    const main = document.createElement('main');
    main.getBoundingClientRect = () =>
      ({ ...canvas, left: 0, right: 1440, width: 1440 }) as DOMRect;
    const tree = document.createElement('aside');
    tree.setAttribute('data-contents-sidebar', '');
    tree.getBoundingClientRect = () => rect(0, 264);
    const rail = document.createElement('aside');
    rail.setAttribute('data-page-rail', 'docked');
    rail.getBoundingClientRect = () => rect(1160, 1440);
    // The rail's card below 1,280 px floats over the page: it takes no room.
    const card = document.createElement('div');
    card.setAttribute('data-page-rail', 'card');
    card.getBoundingClientRect = () => rect(1100, 1380);
    document.body.append(tree, rail, card);
    expect(sideChromeInsets(main)).toEqual({ left: 264, right: 280 });
    tree.remove();
    rail.remove();
    card.remove();
  });
});
