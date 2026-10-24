// @vitest-environment jsdom
import { ICON_STROKE_PX } from '@liveworkspace/icons';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Glyph } from './Glyph';

describe('Glyph weight', () => {
  // The stroke is non-scaling, so the grid a glyph is drawn on never changes its on-screen weight.
  it('draws the same on-screen stroke whatever the viewBox', () => {
    const at = (units: number) =>
      render(<Glyph size={16} units={units} />)
        .container.querySelector('svg')!
        .getAttribute('stroke-width');
    expect(at(16)).toBe(String(ICON_STROKE_PX));
    expect(at(24)).toBe(at(16));
    expect(at(20)).toBe(at(16));
  });
});
