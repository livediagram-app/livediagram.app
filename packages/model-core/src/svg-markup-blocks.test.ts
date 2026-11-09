import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { holdFaceBlocks, markedGroup, restoreFaceBlocks } from './svg-markup-blocks';

// The face passes' block scans (each product's svgMarkerFace and svgSketchFace). A body cut short left an unmatched
// `</g>` in the export, and the browser drew the whole preview as a broken image.
describe('markedGroup', () => {
  const at = (m: string, attr: string) => {
    const r = markedGroup(m, attr);
    return r ? m.slice(r[0], r[1]) : null;
  };

  it('ends at its own </g>, past the groups nested in it', () => {
    const body =
      '<g data-finish="sketch"><path/><g data-marker-part="shape"><path/></g><path/></g>';
    expect(at(`<rect/>${body}<g><text>x</text></g>`, 'data-finish="sketch"')).toBe(body);
  });

  it('does not count a self-closing group as opening one', () => {
    const body = '<g data-finish="sketch"><g/><path/></g>';
    expect(at(`${body}</g>`, 'data-finish="sketch"')).toBe(body);
  });

  it('is null when the group never closes', () => {
    expect(
      markedGroup('<g data-finish="sketch"><g><path/></g>', 'data-finish="sketch"'),
    ).toBeNull();
    expect(markedGroup('<g data-finish="sketch"><g', 'data-finish="sketch"')).toBeNull();
  });

  it('is null when there is none, or the attribute is not on a group', () => {
    expect(markedGroup('<rect/>', 'data-finish="sketch"')).toBeNull();
    expect(markedGroup('<g><rect data-finish="sketch"/></g>', 'data-finish="sketch"')).toBeNull();
    expect(markedGroup('<rect data-finish="sketch"/>', 'data-finish="sketch"')).toBeNull();
  });

  it('reads a deep nest in one pass', () => {
    const depth = 50_000;
    const m = `<g data-finish="sketch">${'<g>'.repeat(depth)}${'</g>'.repeat(depth)}</g>`;
    expect(cpuMsOf(() => markedGroup(m, 'data-finish="sketch"'))).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('holdFaceBlocks', () => {
  it('holds a sketched body and a marker body whole, with the definitions, and puts them back', () => {
    const sketch = '<g transform="t" data-finish="sketch"><path d="M0 0" fill="#ede5fd"/></g>';
    const clip = '<clipPath id="c"><rect/></clipPath>';
    const markup = `${sketch}${clip}<rect fill="#f00"/>`;
    const held: string[] = [];
    const out = holdFaceBlocks(markup, held);
    expect(out).toBe('<!--lvd-held-1--><!--lvd-held-0--><rect fill="#f00"/>');
    expect(held).toEqual([clip, sketch]);
    expect(restoreFaceBlocks(out, held)).toBe(markup);

    const marker = '<g data-finish="marker"><path/></g>';
    const kept: string[] = [];
    expect(holdFaceBlocks(`<path/>${marker}`, kept)).toBe('<path/><!--lvd-held-0-->');
    expect(kept).toEqual([marker]);
  });

  it('leaves a face with nothing to hold as it is', () => {
    const held: string[] = [];
    expect(holdFaceBlocks('<rect/><text>a</text>', held)).toBe('<rect/><text>a</text>');
    expect(held).toEqual([]);
  });
});
