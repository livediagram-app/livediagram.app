// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTitleBar } from './PageTitleBar';

// livedocuments/docs/specs/008-canvas/canvas-performance.md "Chrome on every page": every page wears a title bar,
// so the bar carries no backdrop filter, which Safari runs again for each bar whenever anything behind it repaints.

describe('PageTitleBar', () => {
  it('draws its card without a backdrop filter', () => {
    const { container } = render(<PageTitleBar groups={[[<button key="a">A</button>]]} />);
    const bar = container.querySelector('[data-page-title-bar]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.className).not.toMatch(/backdrop-/);
  });
});
