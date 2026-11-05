// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PixelCharacter } from './pixel-character';

// The pixel character keeps its own colours in dark mode (Work Tracker #492): dark mode turns the help art's slate
// ramp over, which drew its trousers, shoes and eyes light. The figure is drawn as drawn, as the canvas draws it
// (help-art.test.ts checks `help-art-as-drawn` restores every colour dark mode retargets).
describe('PixelCharacter', () => {
  it('draws the figure as drawn in both appearances, its name chip outside that', () => {
    const { container } = render(
      <svg>
        <PixelCharacter fx={50} fy={80} name="Sam" />
      </svg>,
    );
    const figure = container.querySelector('[data-pixel-character]')!;
    expect(figure.getAttribute('class')).toBe('help-art-as-drawn');
    // Trousers, shoes and eyes are inside it; the chip is not.
    expect(figure.querySelectorAll('.fill-slate-600')).toHaveLength(2);
    expect(figure.querySelectorAll('.fill-slate-800')).toHaveLength(4);
    expect(figure.textContent).toBe('');
    expect(container.textContent).toBe('Sam');
  });
});
