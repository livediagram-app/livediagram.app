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
});
