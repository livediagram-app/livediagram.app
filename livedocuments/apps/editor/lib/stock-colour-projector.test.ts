import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  createFreehand,
  penColourHex,
  THEMES,
  themeColourMap,
  themeHalf,
  type Element,
} from '@livedocuments/document';
import { createStockColourProjector, plainPaper } from './stock-colour-projector';

const stroke = (over: Partial<Element> = {}): Element =>
  ({
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
    ),
    ...over,
  }) as Element;

const strokeColorOf = (el: Element | undefined) => (el as { strokeColor?: string }).strokeColor;

describe('createStockColourProjector', () => {
  it('draws a named colour in its version for the canvas surface, on any tab', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'blue' });
    expect(strokeColorOf(project([a], 'light')[0])).toBe(penColourHex('blue', 'light'));
    expect(strokeColorOf(project([a], 'dark')[0])).toBe(penColourHex('blue', 'dark'));
  });

  it('keeps each projected object stable while its source is unchanged', () => {
    // The element views are memoised: a fresh object per render would redraw
    // every stroke on every drag frame.
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'red' });
    const b = stroke({ penColour: 'green' });
    const first = project([a, b], 'light');
    const second = project([a, b], 'light');
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('returns the same board for the same board, so a render that changes no element changes nothing', () => {
    // A pan, zoom or marquee re-renders the editor without touching the elements; a fresh array
    // there rebuilt the Map and every derived pass on each frame (docs/specs/008-canvas/canvas-performance.md).
    const project = createStockColourProjector();
    const board = [stroke({ penColour: 'red' }), stroke()];
    const first = project(board, 'dark');
    expect(project(board, 'dark')).toBe(first);
  });

  it('returns a new board when the board changes', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'red' });
    const first = project([a], 'dark');
    const next = project([a, stroke()], 'dark');
    expect(next).not.toBe(first);
    expect(next[0]).toBe(first[0]);
  });

  it('recomputes when the surface changes (an appearance switch)', () => {
    const project = createStockColourProjector();
    const a = stroke({ penColour: 'teal' });
    const light = project([a], 'light');
    const dark = project([a], 'dark');
    expect(dark[0]).not.toBe(light[0]);
  });

  it('leaves an unpainted element unpainted: the renderer draws its default', () => {
    const project = createStockColourProjector();
    const els = [stroke()];
    expect(project(els, 'light')).toBe(els);
  });
});

// docs/specs/011-theme/light-and-dark.md "A page's own paper": a layout placed on a light slide in Steel keeps its
// dark words in dark chrome, rather than the dark half's light ink sinking into the slide.
describe('createStockColourProjector on a page with its own fill', () => {
  const steel = THEMES.find((t) => t.id === 'steel')!;
  const paper = '#e2e8f0';
  const title = {
    id: 't',
    type: 'text',
    x: 0,
    y: 0,
    width: 300,
    height: 60,
    label: 'Your presentation title',
    textColor: themeHalf(steel, 'light').elementText!,
  } as unknown as Element;
  const maps = { light: themeColourMap(steel, 'light'), dark: themeColourMap(steel, 'dark') };
  const inkOf = (el: Element | undefined) => (el as { textColor?: string }).textColor ?? '';

  it('draws the theme half the page needs, not the chrome’s', () => {
    const project = createStockColourProjector();
    const pageView = { surfaces: new Map([['t', 'light' as const]]), maps };
    const out = project([title], 'dark', maps.dark, pageView);
    expect(contrastRatio(inkOf(out[0]), paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('still draws the chrome’s half off a filled page', () => {
    const project = createStockColourProjector();
    const out = project([title], 'dark', maps.dark, {
      surfaces: new Map(),
      maps,
    });
    expect(inkOf(out[0])).toBe(themeHalf(steel, 'dark').elementText);
  });

  it('draws an element afresh when it moves onto a filled page', () => {
    const project = createStockColourProjector();
    const board = [title];
    const off = project(board, 'dark', maps.dark, { surfaces: new Map(), maps });
    const on = project(board, 'dark', maps.dark, {
      surfaces: new Map([['t', 'light' as const]]),
      maps,
    });
    expect(inkOf(off[0])).not.toBe(inkOf(on[0]));
  });
});

// docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it": the dark editor draws
// the plain paper slate, where a template's dark words made for white (the resume's job titles) would vanish.
describe('createStockColourProjector on the plain paper', () => {
  const words = (id: string, over: Record<string, unknown> = {}) =>
    ({
      id,
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      label: 'Lead Product Designer',
      textColor: '#0f172a',
      ...over,
    }) as unknown as Element;
  const inkOf = (el: Element | undefined) => (el as { textColor?: string }).textColor ?? '';
  const slate = plainPaper('dark').drawn;

  it('lifts dark words off the slate paper in the dark editor', () => {
    const project = createStockColourProjector();
    const out = project([words('w')], 'dark', undefined, undefined, plainPaper('dark'));
    expect(contrastRatio(inkOf(out[0]), slate)).toBeGreaterThanOrEqual(3);
  });

  it('leaves them as made in the light editor, where the paper is white', () => {
    const project = createStockColourProjector();
    const board = [words('w')];
    expect(project(board, 'light', undefined, undefined, plainPaper('light'))).toBe(board);
  });

  it('keeps dark words on a light panel, which is what they are read against', () => {
    const project = createStockColourProjector();
    const panel = {
      id: 'p',
      type: 'shape',
      shape: 'square',
      x: -50,
      y: -50,
      width: 400,
      height: 200,
      label: '',
      fillColor: '#eef2ff',
    } as unknown as Element;
    const out = project([panel, words('w')], 'dark', undefined, undefined, plainPaper('dark'));
    expect(inkOf(out[1])).toBe('#0f172a');
  });

  it('never walks words on a page with a fill of its own against the paper', () => {
    const project = createStockColourProjector();
    const pageView = {
      surfaces: new Map([['w', 'light' as const]]),
      maps: { light: new Map(), dark: new Map() },
    };
    const out = project([words('w')], 'dark', undefined, pageView, plainPaper('dark'));
    expect(inkOf(out[0])).toBe('#0f172a');
  });

  it('keeps a lifted label the same object while it is unchanged', () => {
    const project = createStockColourProjector();
    const w = words('w');
    const first = project([w], 'dark', undefined, undefined, plainPaper('dark'))[0];
    const again = project(
      [w, words('x', { y: 400 })],
      'dark',
      undefined,
      undefined,
      plainPaper('dark'),
    )[0];
    expect(again).toBe(first);
  });
});
