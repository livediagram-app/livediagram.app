// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TabPatternLayer } from './TabPatternLayer';

// A tab's canvas style drawn as its own layer (docs/specs/008-canvas/canvas-and-palette.md "Canvas"), for what covers
// the canvas and the form link's page.

afterEach(cleanup);

describe('TabPatternLayer', () => {
  it('draws nothing for the plain canvas', () => {
    expect(render(<TabPatternLayer pattern="blank" color="#000" />).container.innerHTML).toBe('');
  });

  it('draws a static pattern as tiles with no colour of their own, at the size asked', () => {
    const { container } = render(
      <TabPatternLayer pattern="graph" color="#ff0000" scale={2} className="fixed inset-0" />,
    );
    const layer = container.querySelector<HTMLElement>('[data-tab-pattern-layer]')!;
    expect(layer.className).toContain('fixed');
    expect(layer.className).toContain('pointer-events-none');
    const tiles = layer.firstElementChild as HTMLElement;
    expect(tiles.style.backgroundColor).toBe('transparent');
    expect(tiles.style.backgroundImage).not.toBe('');
    expect(layer.querySelector('[data-animated-pattern]')).toBeNull();
  });

  it('draws an animated pattern as its moving overlay, in its colour, speed and strength', () => {
    const { container } = render(
      <TabPatternLayer pattern="ribbons" color="#00ff00" speed={0.5} opacity={0.3} />,
    );
    const moving = container.querySelector<HTMLElement>('[data-animated-pattern="ribbons"]')!;
    expect(moving.style.getPropertyValue('--lvd-pat')).toBe('#00ff00');
    expect(moving.style.getPropertyValue('--lvd-bg-speed')).toBe('0.5');
    expect(moving.style.opacity).toBe('0.3');
  });
});
