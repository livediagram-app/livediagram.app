import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { applyShapeVariant } from './shape-variants';
import { svgBoxed } from './svg-render';
import { statRowLayout, statsHaveChange } from './web-components';

// docs/specs/009-elements/quote.md "Agents and export", stat-row.md "Export".
describe('the quote in the export', () => {
  const quote = createShape('quote', 10, 20);

  it('draws its card, mark, words, initial, name and role', () => {
    const svg = svgBoxed(quote);
    expect(svg).toContain('<rect');
    expect(svg).toContain('“</text>');
    expect(svg).toContain('Sam Rivera');
    expect(svg).toContain('Operations Lead, Example Co');
    expect(svg).toContain('>S</text>');
    expect(svg).toContain('<circle');
  });

  it('a Plain quote draws no box', () => {
    const svg = svgBoxed(applyShapeVariant(quote, 'pull'));
    expect(svg).not.toMatch(/<rect[^>]*stroke-width="1"/);
    expect(svg).toContain('Alex Morgan');
  });

  it('a photo is clipped to a circle from its resolved bytes, else the initial stands in', () => {
    const withPhoto = { ...quote, imageId: 'img-1' };
    const drawn = svgBoxed(withPhoto, { resolveImageHref: (id) => `data:image/png;base64,${id}` });
    expect(drawn).toContain('<clipPath');
    expect(drawn).toContain('href="data:image/png;base64,img-1"');
    const missing = svgBoxed(withPhoto);
    expect(missing).not.toContain('<image');
    expect(missing).toContain('>S</text>');
  });
});

describe('the stat row change line', () => {
  const big = applyShapeVariant(createShape('stat-row', 0, 0), 'big-number');

  it('lays the change out under the caption only when the row has one', () => {
    expect(statsHaveChange(big.stats ?? [])).toBe(true);
    const l = statRowLayout(320, 220, 1, true);
    expect(l.change).not.toBeNull();
    expect(l.change!.y).toBeGreaterThan(l.caption.y);
    expect(l.caption.y).toBeGreaterThan(l.value.y);
    expect(statRowLayout(320, 220, 1).change).toBeNull();
    expect(l.valuePx).toBeLessThanOrEqual(96);
  });

  it('draws the change in its trend colour over a pill', () => {
    const svg = svgBoxed(big);
    expect(svg).toContain('▲ 24% on last year');
    expect(svg).toContain('86k');
    const down = svgBoxed({ ...big, stats: [{ value: '3', caption: 'Churn', change: '▼ 1%' }] });
    expect(down).not.toBe(svg);
    expect(svg).toMatch(/<rect[^>]*rx=/);
  });
});
