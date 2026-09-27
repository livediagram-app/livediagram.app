// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { apply } from './matrix';
import { anchorMatrix, innerMatrix, inlineStyle, px } from './placement';

const fragment = (html: string) => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return doc.body.firstElementChild!;
};

describe('inlineStyle and px', () => {
  it('reads declarations and px lengths', () => {
    const el = fragment('<div style="LEFT: 12.5px; top:-3px; transform: scale(2)"></div>');
    const style = inlineStyle(el);
    expect(px(style.get('left'))).toBe(12.5);
    expect(px(style.get('top'))).toBe(-3);
    expect(style.get('transform')).toBe('scale(2)');
    expect(px('10%')).toBeNull();
  });
});

describe('innerMatrix', () => {
  it('composes CSS boxes, an svg viewBox and SVG transforms down to the node', () => {
    const anchor = fragment(`
      <div class="anchor" style="left: 100px; top: 100px;">
        <div style="position: absolute; left: 10px; top: 20px;">
          <svg width="200" height="100" viewBox="0 0 100 50">
            <g transform="translate(5 5)"><path id="p" d="M0 0"></path></g>
          </svg>
        </div>
      </div>`);
    const path = anchor.querySelector('#p')!;
    const inner = innerMatrix(path, anchor);
    // viewBox doubles; translate(5 5) becomes 10 px; the div adds (10, 20).
    expect(apply(inner.matrix, { x: 1, y: 1 })).toEqual({ x: 22, y: 32 });
    const board = apply(anchorMatrix(anchor).matrix, apply(inner.matrix, { x: 1, y: 1 }));
    expect(board).toEqual({ x: 122, y: 132 });
  });

  it('centres a viewBox that does not fill its box (xMidYMid meet)', () => {
    const anchor = fragment(
      '<div><svg width="200" height="200" viewBox="0 0 100 50"><path id="p"></path></svg></div>',
    );
    const inner = innerMatrix(anchor.querySelector('#p')!, anchor);
    expect(apply(inner.matrix, { x: 0, y: 0 })).toEqual({ x: 0, y: 50 });
  });

  it('places a nested svg at its x and y', () => {
    const anchor = fragment('<div><svg><svg x="7" y="9"><path id="p"></path></svg></svg></div>');
    const inner = innerMatrix(anchor.querySelector('#p')!, anchor);
    expect(apply(inner.matrix, { x: 0, y: 0 })).toEqual({ x: 7, y: 9 });
  });

  it('names transforms it cannot apply', () => {
    const anchor = fragment(
      '<div><svg><g transform="skewX(5)"><path id="p"></path></g></svg></div>',
    );
    expect(innerMatrix(anchor.querySelector('#p')!, anchor).unknown).toEqual(['skewX']);
  });
});
