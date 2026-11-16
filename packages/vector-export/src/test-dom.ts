// Test helper: what a browser gives the writer that jsdom does not (layout, computed style, canvas, pictures, fonts),
// stood in for simply and predictably. Not shipped. Each character is 8 px wide along its text's baseline.
import { vi } from 'vitest';

// Inherited presentation attributes the outliner reads by camelCase name, up the tree, with the browser's defaults.
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
    const entry = INHERITED[prop];
    if (!entry) return '';
    const [attr, fallback] = entry;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const own = (e as SVGElement).style?.[prop as 'fontFamily'];
      if (own) return own;
      const v = e.getAttribute(attr);
      if (v !== null) return /^\d+(\.\d+)?$/.test(v) && prop === 'fontSize' ? `${v}px` : v;
    }
    return fallback;
  };
  // Painting properties are left to the writer's own attribute reading (as with no layout engine); baselines are
  // what an element names itself.
  const value = (name: string) =>
    name.endsWith('baseline')
      ? (el as SVGElement).style?.getPropertyValue(name) || el.getAttribute(name) || 'auto'
      : '';
  return new Proxy({} as CSSStyleDeclaration, {
    get: (_t, p) => (p === 'getPropertyValue' ? value : read(String(p))),
  });
}

/** A fake 2d context: remembers its fill, reads every pixel back as that colour at `alpha`. */
function context(canvas: HTMLCanvasElement, alpha: number) {
  let fill = '#000000';
  return {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      // An unknown colour leaves the last one, as a canvas does.
      if (/^#[0-9a-f]{6}$/i.test(v) || v === 'rebeccapurple')
        fill = v === 'rebeccapurple' ? '#663399' : v;
    },
    fillRect: () => {},
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      const n = parseInt(fill.slice(1), 16);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (n >> 16) & 255;
        data[i + 1] = (n >> 8) & 255;
        data[i + 2] = n & 255;
        data[i + 3] = alpha;
      }
      return { data, width: w, height: h };
    },
    canvas,
  };
}

export type Dom = { added: unknown[]; deleted: unknown[]; drawn: string[] };

/** Installs the stand-ins; `opts.alpha` is the alpha every canvas pixel reads back with. */
export function installDom(opts: { alpha?: number } = {}): Dom {
  const dom: Dom = { added: [], deleted: [], drawn: [] };
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
      add: (f: unknown) => dom.added.push(f),
      delete: (f: unknown) => dom.deleted.push(f),
      ready: Promise.resolve(),
    },
  });
  const alpha = opts.alpha ?? 255;
  (window.HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (
    this: HTMLCanvasElement,
  ) {
    return context(this, alpha);
  };
  // A picture loads at 4 x 2 px, or fails when its address says so.
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 4;
      naturalHeight = 2;
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(v: string) {
        dom.drawn.push(v);
        queueMicrotask(() => (v.includes('broken') ? this.onerror?.() : this.onload?.()));
      }
    },
  );
  const proto = window.SVGElement.prototype as unknown as Record<string, unknown>;
  const origin = (el: Element) => ({
    x: parseFloat(el.getAttribute('x') ?? '0') || 0,
    y: parseFloat(el.getAttribute('y') ?? '0') || 0,
  });
  proto.getNumberOfChars = function (this: Element) {
    return (this.textContent ?? '').replace(/\n/g, '').replace(/\s+/g, ' ').trim().length;
  };
  proto.getStartPositionOfChar = function (this: Element, i: number) {
    const o = origin(this);
    return { x: o.x + i * 8, y: o.y };
  };
  proto.getEndPositionOfChar = function (this: Element, i: number) {
    const o = origin(this);
    return { x: o.x + i * 8 + 8, y: o.y };
  };
  proto.getRotationOfChar = () => 0;
  proto.getExtentOfChar = function (this: Element, i: number) {
    const o = origin(this);
    return { x: o.x + i * 8, y: o.y - 10, width: 8, height: 12 };
  };
  proto.getBBox = function (this: Element) {
    const n = (a: string) => parseFloat(this.getAttribute(a) ?? '0') || 0;
    if (this.localName === 'text') {
      const o = origin(this);
      return { x: o.x, y: o.y - 10, width: (this.textContent ?? '').length * 8, height: 12 };
    }
    if (this.hasAttribute('data-no-bbox')) throw new Error('not rendered');
    return { x: n('x'), y: n('y'), width: n('width') || 10, height: n('height') || 10 };
  };
  return dom;
}

const square = {
  commands: [
    { command: 'moveTo', args: [0, 0] },
    { command: 'lineTo', args: [500, 0] },
    { command: 'quadraticCurveTo', args: [500, 700, 0, 700] },
    { command: 'closePath', args: [] },
  ],
};

/** A fontkit stand-in: every letter a 500-unit glyph whose id is its code point, a space no outline. */
export const fakeFontkit = () => {
  const font = () => ({
    type: 'TTF',
    unitsPerEm: 1000,
    ascent: 900,
    getVariation: () => font(),
    getGlyph: () => undefined,
    layout: (text: string) => ({
      glyphs: [...text].map((c) => ({
        id: c.codePointAt(0)!,
        codePoints: [c.codePointAt(0)!],
        path: c === ' ' ? { commands: [] } : square,
      })),
    }),
  });
  return { create: vi.fn(font) };
};

export const FACE_DATA = 'data:font/ttf;base64,AAEC';
export const faceCss = (family: string, weight = '100 900') =>
  `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(${FACE_DATA}); }`;
