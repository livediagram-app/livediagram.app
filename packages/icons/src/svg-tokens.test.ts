import { describe, expect, it } from 'vitest';

import { svgElements } from './svg-tokens';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';

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

  it('reads namespaced, dotted and numbered names, single quotes and spaced equals signs', () => {
    expect(svgElements("<use xlink:href='#a' data.x-1 = \"2\"\n\ty='3'/><H1>")).toEqual([
      { tag: 'use', attrs: { 'xlink:href': '#a', 'data.x-1': '2', y: '3' } },
      { tag: 'H1', attrs: {} },
    ]);
  });

  it('skips an unquoted value', () => {
    expect(svgElements('<a b=c d="e">')).toEqual([{ tag: 'a', attrs: { d: 'e' } }]);
  });

  it('stops at an unterminated value', () => {
    expect(svgElements('<a b="open')).toEqual([{ tag: 'a', attrs: {} }]);
  });

  it('stays linear on hostile input', () => {
    // CPU time, not wall-clock (cpuMsOf): immune to other suites sharing the box.
    const spent = cpuMsOf(() => {
      svgElements('<path ' + 'A'.repeat(200_000));
      svgElements('<path'.repeat(50_000));
      svgElements('<a b="'.repeat(50_000));
    });
    expect(spent).toBeLessThan(200);
  });
});
