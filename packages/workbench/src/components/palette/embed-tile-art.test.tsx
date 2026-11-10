// @vitest-environment jsdom

// The embed providers' tile art (docs/specs/004-interface-design/iconography.md, "Art"), written as JSX since it
// was markup strings: the DOM each one draws is the one the string drew.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import { FigmaTileArt, LoomTileArt, VimeoTileArt, YouTubeTileArt } from './embed-tile-art';

afterEach(cleanup);

// The markup each tile wrote into its <svg> before (attributes as the strings spelled them).
const BEFORE: [string, ComponentType, string][] = [
  [
    'YouTube',
    YouTubeTileArt,
    `<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10.5 8.75 16 12l-5.5 3.25z" fill="#ffffff" />`,
  ],
  [
    'Vimeo',
    VimeoTileArt,
    `<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M7 9c1.6-1.5 3 .4 3.4 2 .5 2 1 3.6 2 1.4C13.6 9.9 12.4 8 15 8c2 0 2.4 2.2 1.3 4.4C15 15.4 12.6 17 11 16c-1.7-1-2-4.2-2.6-5.4-.4-.8-.9-.4-1.4 0z" fill="currentColor" stroke="none" />`,
  ],
  [
    'Loom',
    LoomTileArt,
    `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /><path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
  ],
  [
    'Figma',
    FigmaTileArt,
    `<rect x="7" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="12" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="8.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><circle cx="14.5" cy="11.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="14.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" />`,
  ],
];

describe('the embed tile art', () => {
  it.each(BEFORE)('%s draws the same SVG as its old markup string', (_, Art, markup) => {
    const { container } = render(<Art />);
    const svg = container.querySelector('svg')!;
    const before = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // The old markup, parsed the way the browser parsed it into the <svg>.
    before.innerHTML = markup;
    expect(svg.innerHTML).toBe(before.innerHTML);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
