// @vitest-environment jsdom
// The empty-canvas card's picture shows what the tab's mode makes.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyCanvasArt } from './EmptyCanvasArt';

afterEach(cleanup);

describe('the empty-canvas picture', () => {
  it('draws a different, decorative scene per mode', () => {
    const scene = (mode: 'diagram' | 'workshop') => {
      const { container, unmount } = render(<EmptyCanvasArt mode={mode} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const html = svg.innerHTML;
      unmount();
      return html;
    };
    const shown = new Set([scene('diagram'), scene('workshop')]);
    expect(shown.size).toBe(2);
  });
});
