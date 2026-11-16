// @vitest-environment jsdom
// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": the kit's SVG with every <text> drawn as outlines in the
// faces it embeds, and no font left in the file. jsdom lays nothing out, so the SVG text positions, computed styles
// and FontFace are stood in for here; the real layout is checked in a browser (see the PR's Verify notes).
import { parseInert } from '@liveworkspace/trusted-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutlineGlyph } from './glyph-paths';
import { OutlineError } from './outline-error';
import type { Fontkit, FontkitFont } from './outline-font';
import { outlineSvgText, stackFamilies } from './outline-svg';

const DATA = 'data:font/woff2;base64,AAEC';
const CSS = `@font-face { font-family: 'Lobster'; font-weight: 400; src: url(${DATA}) format('woff2'); unicode-range: U+0000-00FF; }
@font-face { font-family: 'Inter'; font-weight: 100 900; src: url(${DATA}); }`;
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><style type="text/css">${CSS}</style></defs>${body}</svg>`;

const square: OutlineGlyph['path'] = {
  commands: [
    { command: 'moveTo', args: [0, 0] },
    { command: 'lineTo', args: [1000, 1000] },
    { command: 'closePath', args: [] },
  ],
};
const fakeFont = (): FontkitFont => ({
  type: 'WOFF2',
  unitsPerEm: 1000,
  ascent: 900,
  getVariation: () => fakeFont(),
  getGlyph: () => undefined,
  layout: (text: string) => ({
    glyphs: [...text].map((c) => ({
      codePoints: [c.codePointAt(0)!],
      path: c === ' ' ? { commands: [] } : square,
    })),
  }),
});
const loadFontkit = vi.fn(async (): Promise<Fontkit> => ({ create: vi.fn(fakeFont) }));

// Inherited presentation attributes, read up the tree, as the browser's computed style would give them.
const INHERITED: Record<string, [string, string]> = {
  fontFamily: ['font-family', 'serif'],
  fontWeight: ['font-weight', '400'],
  fontStyle: ['font-style', 'normal'],
  fontSize: ['font-size', '16px'],
  letterSpacing: ['letter-spacing', 'normal'],
  fill: ['fill', 'rgb(0, 0, 0)'],
  fillOpacity: ['fill-opacity', '1'],
  stroke: ['stroke', 'none'],
  strokeWidth: ['stroke-width', '1px'],
  strokeOpacity: ['stroke-opacity', '1'],
};
function computed(el: Element): CSSStyleDeclaration {
  const read = (prop: string): string => {
    if (prop === 'textDecorationLine') return el.getAttribute('text-decoration') ?? 'none';
    const [attr, fallback] = INHERITED[prop]!;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const own = (e as SVGElement).style?.[prop as 'fontFamily'];
      if (own) return own;
      const v = e.getAttribute(attr);
      if (v !== null) return /^\d+$/.test(v) && prop === 'fontSize' ? `${v}px` : v;
    }
    return fallback;
  };
  // The baselines, as an element names them itself (an inline style first, as the outliner sets one).
  const baseline = (name: string) =>
    (el as SVGElement).style?.getPropertyValue(name) || el.getAttribute(name) || 'auto';
  return new Proxy({} as CSSStyleDeclaration, {
    get: (_t, p) => (p === 'getPropertyValue' ? baseline : read(String(p))),
  });
}

// A text set `dominant-baseline="central"` draws 7 px lower than its start positions say, as Chromium does, until
// its baseline is set back to auto.
const CENTRAL_DROP = 7;

const added: FontFace[] = [];
const deleted: FontFace[] = [];
beforeEach(() => {
  added.length = 0;
  deleted.length = 0;
  vi.stubGlobal('getComputedStyle', computed);
  vi.stubGlobal(
    'FontFace',
    class {
      load = async () => this;
    },
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add: (f: FontFace) => added.push(f),
      delete: (f: FontFace) => deleted.push(f),
      ready: Promise.resolve(),
    },
  });
  const proto = window.SVGElement.prototype as unknown as Record<string, unknown>;
  // Each addressable character 10 px wide along y = 50, from x = 10 × its index.
  proto.getNumberOfChars = function (this: Element) {
    const fixed = this.getAttribute('data-count');
    if (fixed) return Number(fixed);
    return (this.textContent ?? '').replace(/\n/g, '').replace(/\s+/g, ' ').trim().length;
  };
  proto.getStartPositionOfChar = function (this: Element, i: number) {
    if (i >= Number(this.getAttribute('data-laid') ?? Infinity)) throw new Error('not laid out');
    return { x: i * 10, y: 50 };
  };
  proto.getEndPositionOfChar = (i: number) => ({ x: i * 10 + 10, y: 50 });
  proto.getRotationOfChar = function (this: Element) {
    return this.hasAttribute('data-nan') ? NaN : 0;
  };
  proto.getExtentOfChar = function (this: SVGElement, i: number) {
    if (this.hasAttribute('data-no-extent')) throw new Error('no extent');
    const central =
      this.getAttribute('dominant-baseline') === 'central' &&
      this.style.getPropertyValue('dominant-baseline') !== 'auto';
    return { x: i * 10, y: 40 + (central ? CENTRAL_DROP : 0), width: 10, height: 12 };
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  loadFontkit.mockClear();
});

const parse = (out: string) => parseInert(out, 'image/svg+xml');

describe('stackFamilies', () => {
  it('reads a computed stack in order, unquoted', () => {
    expect(stackFamilies(`"Playfair Display", 'Lobster',  serif ,`)).toEqual([
      'Playfair Display',
      'Lobster',
      'serif',
    ]);
  });
});

describe('outlineSvgText', () => {
  it('drops the embedded faces of an SVG with no text, without loading fontkit', async () => {
    const out = await outlineSvgText(svg('<rect width="10" height="10"/>'), CSS, { loadFontkit });
    expect(out).not.toContain('@font-face');
    expect(parse(out).querySelector('defs')).toBeNull();
    expect(parse(out).querySelector('rect')).not.toBeNull();
    expect(loadFontkit).not.toHaveBeenCalled();
  });

  it('hands back an SVG with no text and no faces untouched', async () => {
    const bare = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    expect(await outlineSvgText(bare, CSS, { loadFontkit })).toBe(bare);
  });

  it('draws a text set on a central baseline where the browser draws it, not where its start positions say', async () => {
    const out = await outlineSvgText(
      svg(
        `<text font-family="Inter" font-size="10" dominant-baseline="central" style="dominant-baseline: central">a</text><text font-family="Inter" font-size="10">a</text>`,
      ),
      CSS,
      { loadFontkit },
    );
    const [central, plain] = [...parse(out).querySelectorAll('path')].map((p) =>
      p.getAttribute('d'),
    );
    expect(central!.startsWith(`M0 ${50 + CENTRAL_DROP}`)).toBe(true);
    expect(plain!.startsWith('M0 50')).toBe(true);
  });

  it('puts a baseline it set back for measuring as it was', async () => {
    document.body.innerHTML = '';
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('dominant-baseline', 'central');
    t.style.setProperty('dominant-baseline', 'central');
    t.textContent = 'ab';
    const { baselineShifts } = await import('./outline-element');
    expect(baselineShifts(t as unknown as SVGTextContentElement, 2)).toEqual([
      [0, CENTRAL_DROP],
      [0, CENTRAL_DROP],
    ]);
    expect(t.style.getPropertyValue('dominant-baseline')).toBe('central');
    expect(t.style.getPropertyValue('alignment-baseline')).toBe('');
    t.setAttribute('data-no-extent', '');
    expect(baselineShifts(t as unknown as SVGTextContentElement, 1)).toEqual([[0, 0]]);
  });

  it('draws each text as paths in its face, keeps its transform, drops every font, and cleans up', async () => {
    const out = await outlineSvgText(
      svg(
        `<text x="0" y="50" font-family="Lobster, cursive" font-size="10" fill="#123456" fill-opacity="0.5" transform="rotate(5)" opacity="0.8">Hi you</text>`,
      ),
      CSS,
      { loadFontkit },
    );
    const doc = parse(out);
    expect(doc.querySelector('text')).toBeNull();
    expect(out).not.toContain('@font-face');
    expect(doc.querySelector('defs')).toBeNull();
    const g = doc.querySelector('g')!;
    expect(g.getAttribute('transform')).toBe('rotate(5)');
    expect(g.getAttribute('opacity')).toBe('0.8');
    const paths = g.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute('fill')).toBe('#123456');
    expect(paths[0]!.getAttribute('fill-opacity')).toBe('0.5');
    // Five glyphs (the space draws nothing), the first at x 0.
    expect(paths[0]!.getAttribute('d')!.match(/M/g)).toHaveLength(5);
    expect(paths[0]!.getAttribute('d')!.startsWith('M0 50L10 40Z')).toBe(true);
    expect(added).toHaveLength(2);
    expect(deleted).toEqual(added);
    expect(document.body.children).toHaveLength(0);
  });

  it('splits runs by face and style, and sets a system stack in Inter', async () => {
    const out = await outlineSvgText(
      svg(
        `<text font-size="10"><tspan font-family="Lobster">ab</tspan><tspan font-family="Inter" font-weight="700">cd</tspan></text><text font-family="system-ui, sans-serif">e</text>`,
      ),
      CSS,
      { loadFontkit },
    );
    const groups = parse(out).querySelectorAll('g');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.querySelectorAll('path')).toHaveLength(2);
    expect(groups[1]!.querySelectorAll('path')).toHaveLength(1);
  });

  it('thickens a synthetic bold with a stroke of its fill, and keeps a stroke the text has', async () => {
    const out = await outlineSvgText(
      svg(
        `<text font-family="Lobster" font-weight="700" font-size="36" fill="red" fill-opacity="0.5">a</text><text font-family="Inter" stroke="blue" stroke-width="2" stroke-opacity="0.4">b</text>`,
      ),
      CSS,
      { loadFontkit },
    );
    const [bold, stroked] = [...parse(out).querySelectorAll('path')];
    expect(bold!.getAttribute('stroke')).toBe('red');
    expect(bold!.getAttribute('stroke-width')).toBe('1.13');
    expect(bold!.getAttribute('stroke-linejoin')).toBe('miter');
    expect(bold!.getAttribute('stroke-opacity')).toBe('0.5');
    expect(stroked!.getAttribute('stroke')).toBe('blue');
    expect(stroked!.getAttribute('stroke-width')).toBe('2');
    expect(stroked!.getAttribute('stroke-opacity')).toBe('0.4');
  });

  it('draws an underline and a strikethrough as their own paths, under the spaces too', async () => {
    const out = await outlineSvgText(
      svg(
        `<text font-family="Inter" font-size="10" text-decoration="underline line-through">a b</text>`,
      ),
      CSS,
      { loadFontkit },
    );
    const paths = [...parse(out).querySelectorAll('path')];
    expect(paths).toHaveLength(3);
    expect(paths[1]!.getAttribute('d')!.match(/M/g)).toHaveLength(3);
    expect(paths[1]!.hasAttribute('stroke')).toBe(false);
  });

  it('leaves out a character the browser did not lay out', async () => {
    const out = await outlineSvgText(
      svg(`<text font-family="Inter" data-laid="1" data-nan="">ab</text>`),
      CSS,
      { loadFontkit },
    );
    expect(parse(out).querySelectorAll('path')).toHaveLength(0);
  });

  it('refuses letters no embedded face has, naming the face and the letters, and still cleans up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = await outlineSvgText(svg(`<text font-family="Lobster">Logo 字字</text>`), CSS, {
      loadFontkit,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OutlineError);
    expect((err as Error).message).toBe(
      "The letters “字” aren't in Lobster's Latin set, so they can't be outlined.",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Logo');
    expect(document.body.children).toHaveLength(0);
    expect(deleted).toHaveLength(2);
  });

  it("refuses a text whose characters it can't map to the browser's", async () => {
    const err = await outlineSvgText(
      svg(`<text font-family="Inter" data-count="9">ab</text>`),
      CSS,
      {
        loadFontkit,
      },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'layout' });
  });

  it('loads fontkit itself when no loader is given', async () => {
    const out = await outlineSvgText(
      svg(`<text font-family="Inter">a</text>`),
      `@font-face { font-family: 'Inter'; src: url(${DATA}); }`,
    ).catch((e: unknown) => e);
    // The stand-in bytes are no real font, so fontkit itself refuses them: proof it was the real one.
    expect(out).toBeInstanceOf(Error);
  });
});
