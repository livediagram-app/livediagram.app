import { describe, expect, it } from 'vitest';
import { articleOpsToSvg } from './article-draw-ops';

// docs/specs/007-editor/article-pages.md "Everywhere a page goes": the writing's operations as SVG.
describe('the writing as SVG', () => {
  it('draws backgrounds, rules, boxes and words, escaped', () => {
    const svg = articleOpsToSvg([
      { k: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#eee', r: 4 },
      { k: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#ddd' },
      { k: 'line', x1: 0, y1: 1, x2: 9, y2: 1, stroke: '#000', width: 1 },
      { k: 'check', x: 0, y: 0, size: 16, stroke: '#00f', done: true },
      { k: 'check', x: 0, y: 0, size: 16, stroke: '#00f', done: false },
      {
        k: 'text',
        x: 1,
        y: 2,
        text: 'A & B',
        family: 'Inter',
        size: 16,
        weight: '700',
        style: 'italic',
        color: '#111',
        underline: true,
        strike: true,
        anchor: 'middle',
      },
      {
        k: 'text',
        x: 1,
        y: 2,
        text: 'plain',
        family: 'Inter',
        size: 16,
        weight: '400',
        style: 'normal',
        color: '#111',
      },
    ]);
    expect(svg).toContain('rx="4"');
    expect(svg).toContain('<line');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-decoration="underline line-through"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg.match(/<path/g)).toHaveLength(1);
  });

  it('draws a line of several styles as one text of tspans', () => {
    const svg = articleOpsToSvg([
      {
        k: 'text',
        x: 0,
        y: 10,
        text: 'Lead: rest',
        family: 'Inter',
        size: 16,
        weight: '400',
        style: 'normal',
        color: '#111',
        runs: [
          { text: 'Lead: ', weight: '700', style: 'normal' },
          { text: 'rest', weight: '400', style: 'italic' },
        ],
      },
    ]);
    expect(svg).toContain(
      '<tspan font-weight="700">Lead: </tspan><tspan font-weight="400" font-style="italic">rest</tspan>',
    );
  });
});
