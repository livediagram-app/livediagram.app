import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST, type CanvasSurface } from './colors';
import { createTable } from './factories';
import { svgTableShape } from './svg-render-table';
import { TABLE_HEADER_BASE, tableHeaderColours } from './table-header-colours';
import { tableColorPresets } from './theme-presets';
import { THEMES } from './themes-data';
import type { TableElement } from './index';

// docs/specs/008-canvas/canvas-and-palette.md Table: the header band follows the surface the table is
// drawn on, and its ink meets AA against it, on the canvas and in every export.

const SURFACES: CanvasSurface[] = ['light', 'dark'];
const table = (o: Partial<TableElement> = {}): TableElement => ({
  ...createTable(0, 0),
  cells: [
    ['Brand', 'Share'],
    ['Oat', '42%'],
  ],
  ...o,
});

describe('tableHeaderColours', () => {
  it.each(SURFACES)('paints an unstyled header band its ink reads on, on %s paper', (surface) => {
    const { fill, ink } = tableHeaderColours(table(), surface);
    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('draws a dark band on dark paper, not the light one a white base gives', () => {
    const { fill, ink } = tableHeaderColours(table(), 'dark');
    // Darker than the light-paper band and close to the dark base it tints.
    expect(contrastRatio(fill, TABLE_HEADER_BASE.dark)).toBeLessThan(1.5);
    expect(contrastRatio(fill, '#ffffff')).toBeGreaterThan(MIN_TEXT_CONTRAST);
    expect(ink).toBe('#ffffff');
  });

  // docs/specs/011-theme/light-and-dark.md "Colours an agent writes".
  it('tints a shorthand or named stroke into a band, never paints the stroke itself', () => {
    const named = tableHeaderColours(table({ strokeColor: 'red', fillColor: 'white' }), 'light');
    const hex = tableHeaderColours(
      table({ strokeColor: '#ff0000', fillColor: '#ffffff' }),
      'light',
    );
    expect(named).toEqual(hex);
    expect(tableHeaderColours(table({ strokeColor: '#f00', fillColor: '#fff' }), 'light')).toEqual(
      hex,
    );
    // A translucent fill shows the paper, so the band tints the paper.
    const clear = tableHeaderColours(table({ strokeColor: 'red', fillColor: '#fff0' }), 'dark');
    expect(clear).toEqual(tableHeaderColours(table({ strokeColor: 'red' }), 'dark'));
  });

  it('tints the cells own fill when they have one', () => {
    const { fill } = tableHeaderColours(
      table({ fillColor: '#fef3c7', strokeColor: '#000000' }),
      'dark',
    );
    // 18% black over amber-100.
    expect(fill).toBe('#d0c7a3');
  });

  it('keeps an explicit header fill and lifts an ink that cannot read on it', () => {
    const { fill, ink } = tableHeaderColours(
      table({ headerFill: '#f1f5f9', headerTextColor: '#ffffff' }),
      'dark',
    );
    expect(fill).toBe('#f1f5f9');
    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('keeps an explicit header ink that already reads', () => {
    expect(
      tableHeaderColours(table({ headerFill: '#0f172a', headerTextColor: '#f8fafc' }), 'light').ink,
    ).toBe('#f8fafc');
  });

  it('checks a transparent band against the paper under it', () => {
    const { fill, ink } = tableHeaderColours(
      table({ headerFill: 'transparent', headerTextColor: '#0c4a6e' }),
      'dark',
    );
    expect(fill).toBe('transparent');
    expect(contrastRatio(ink, TABLE_HEADER_BASE.dark)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(SURFACES)('every table preset under every theme reads on %s paper', (surface) => {
    for (const theme of THEMES) {
      for (const p of tableColorPresets(theme)) {
        const el = table({
          fillColor: p.fill,
          strokeColor: p.stroke,
          textColor: p.text,
          headerFill: p.headerFill,
          headerTextColor: p.headerText,
        });
        const { fill, ink } = tableHeaderColours(el, surface);
        const cells = p.fill === 'transparent' ? TABLE_HEADER_BASE[surface] : p.fill;
        const behind = fill === 'transparent' ? cells : fill;
        expect(contrastRatio(ink, behind), `${theme.id} ${p.id}`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      }
    }
  });
});

describe('svgTableShape header band', () => {
  it.each(SURFACES)('exports the band and ink the canvas paints, on %s paper', (surface) => {
    const el = table();
    const { fill, ink } = tableHeaderColours(el, surface);
    const svg = svgTableShape(el, surface);
    expect(svg).toContain(`fill="${fill}"`);
    // The header cells are written in the band's ink.
    expect(svg).toMatch(new RegExp(`font-weight="700" fill="${ink}"[^>]*>(<tspan[^>]*>)Brand`));
  });

  it('draws no band for a transparent header fill', () => {
    const svg = svgTableShape(table({ headerFill: 'transparent' }), 'dark');
    expect(svg).not.toContain('fill="transparent"');
  });
});
