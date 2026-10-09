// @vitest-environment jsdom
// The Sheet's palette glyph (docs/specs/029-sheets/sheet.md "Placing a sheet").
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SheetArt } from './sheet-art';

describe('the sheet glyph', () => {
  it('draws a grid with a filled header row and one ringed cell at the size asked', () => {
    const { container } = render(<SheetArt size={30} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('30');
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
    expect(svg.querySelector('rect[fill="currentColor"]')).toBeTruthy();
  });
});
