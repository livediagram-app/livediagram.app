import { describe, expect, it } from 'vitest';

import { svgElements } from './svg-tokens';

describe('svgElements', () => {
  it('reads each element tag and its attributes', () => {
    expect(
      svgElements('<svg viewBox="0 0 24 24"><path d="M1 2" /><rect x="1" stroke-width="2"/></svg>'),
    ).toEqual([
      { tag: 'svg', attrs: { viewBox: '0 0 24 24' } },
      { tag: 'path', attrs: { d: 'M1 2' } },
      { tag: 'rect', attrs: { x: '1', 'stroke-width': '2' } },
    ]);
  });

  it('skips closing tags, comments and valueless attributes', () => {
    expect(svgElements('<!-- c --><g hidden transform="x"></g>')).toEqual([
      { tag: 'g', attrs: { transform: 'x' } },
    ]);
  });

  it('keeps a > inside a quoted value', () => {
    expect(svgElements('<text data-x="a>b">t</text>')).toEqual([
      { tag: 'text', attrs: { 'data-x': 'a>b' } },
    ]);
  });

  it('stays linear on hostile input', () => {
    const start = performance.now();
    svgElements('<path ' + 'A'.repeat(200_000));
    svgElements('<path'.repeat(50_000));
    svgElements('<a b="'.repeat(50_000));
    expect(performance.now() - start).toBeLessThan(200);
  });
});
