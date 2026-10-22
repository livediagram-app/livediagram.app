import { describe, expect, it } from 'vitest';
import { contrastRatio, defaultStrokeColor, defaultTextColor, hexToRgb } from './colors';
import { createArrow, createShape, createSticky, createTable, createText } from './index';
import type { Element, ShapeElement, TextElement } from './index';
import { pagesOf, layOutPages, type Page, type PageFill } from './page';
import { pageBackgroundSet } from './pages-edits';
import { worstContrast } from './page-ink-contrast';
import { pageGroundUnder } from './page-ink-ground';
import { pageInkFor, pagesInkFor, withPageInkFor, type InkMemory } from './page-ink';

// docs/specs/007-editor/pages-mode.md "Re-inking": nothing on a page becomes hard to read
// when its fill changes, and only what falls under its floor moves.

const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
const at = (dx: number, dy: number) => ({ x: rect.x + dx, y: rect.y + dy });
const tabOf = (elements: Element[], extra: object = {}) => ({
  elements,
  pages: [{ ...PAGE }] as Page[],
  ...extra,
});
// The colours a test reads back.
type Inks = { id: string; textColor: string; strokeColor: string; fillColor: string };
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as unknown as Inks;

function text(id: string, dx: number, dy: number, textColor: string): Element {
  return {
    ...createText(at(dx, dy).x, at(dx, dy).y),
    id,
    width: 120,
    height: 30,
    label: 'Hello',
    textColor,
  };
}
function shape(
  id: string,
  kind: ShapeElement['shape'],
  dx: number,
  dy: number,
  extra: Partial<ShapeElement>,
) {
  return {
    ...createShape(kind, at(dx, dy).x, at(dx, dy).y),
    id,
    width: 120,
    height: 80,
    ...extra,
  } as Element;
}

// Every element type that re-inking reaches, in its author's colours.
function sampler(): Element[] {
  const arrow = {
    ...createArrow(at(20, 600).x, at(20, 600).y, at(200, 600).x, at(200, 600).y),
    id: 'arrow',
    strokeColor: '#475569',
  } as Element;
  const labelled = {
    ...createArrow(at(20, 640).x, at(20, 640).y, at(200, 640).x, at(200, 640).y),
    id: 'arrow-label',
    label: 'Yes',
    strokeColor: '#64748b',
  } as Element;
  const table = {
    ...createTable(at(300, 600).x, at(300, 600).y),
    id: 'table',
    strokeColor: '#94a3b8',
    textColor: '#334155',
    width: 120,
    height: 80,
  } as Element;
  return [
    text('title', 20, 20, '#1e293b'),
    text('soft', 20, 60, '#93c5fd'),
    shape('icon', 'icon', 200, 20, {
      iconId: 'server',
      strokeColor: '#0ea5e9',
      label: 'Server',
      textColor: '#0369a1',
      width: 40,
      height: 40,
    }),
    shape('outline', 'square', 20, 120, {
      fillColor: 'transparent',
      strokeColor: '#cbd5e1',
      label: 'Box',
      textColor: '#475569',
    }),
    shape('card', 'square', 200, 120, {
      fillColor: '#ffffff',
      strokeColor: '#ffffff',
      label: 'Card',
      textColor: '#0f172a',
    }),
    shape('navy-card', 'square', 20, 240, {
      fillColor: '#1e3a8a',
      strokeColor: '#1e3a8a',
      label: 'Navy',
      textColor: '#e0e7ff',
    }),
    shape('rule', 'square', 200, 240, { fillColor: '#0f172a', strokeColor: '#0f172a', height: 4 }),
    shape('disc', 'circle', 20, 360, { fillColor: '#f1f5f9', strokeColor: '#f1f5f9', label: '' }),
    shape('disc-icon', 'icon', 60, 380, {
      iconId: 'server',
      strokeColor: '#334155',
      width: 40,
      height: 40,
    }),
    shape('tick', 'icon', 200, 360, {
      iconId: 'check',
      strokeColor: '#16a34a',
      width: 40,
      height: 40,
    }),
    shape('progress', 'progress-bar', 200, 420, {
      strokeColor: '#38bdf8',
      textColor: '#64748b',
      label: '40%',
    }),
    shape('chart', 'bar-chart', 20, 460, { textColor: '#64748b', label: 'Sales' }),
    arrow,
    labelled,
    table,
  ];
}

const FILLS: Record<string, PageFill | undefined> = {
  paper: undefined,
  pale: { kind: 'solid', color: '#f8fafc' },
  white: { kind: 'solid', color: '#ffffff' },
  dark: { kind: 'solid', color: '#0f172a' },
  navy: { kind: 'solid', color: '#1e3a8a' },
  grey: { kind: 'solid', color: '#808080' },
  red: { kind: 'solid', color: '#dc2626' },
  yellow: { kind: 'solid', color: '#facc15' },
  night: { kind: 'gradient', from: '#0f172a', to: '#1e3a8a', angle: 160 },
  sunrise: { kind: 'gradient', from: '#fde68a', to: '#fca5a5', angle: 160 },
  steep: { kind: 'gradient', from: '#0f172a', to: '#f8fafc', angle: 180 },
  picture: { kind: 'image', imageId: 'abc', tone: '#1f2937' },
};

// The floors, measured independently of the pass's own bookkeeping.
function expectReadable(els: Element[], fill: PageFill | undefined, name: string) {
  const ground = (el: Element) => {
    const b = 'x' in el ? el : { x: 0, y: 0, width: 0, height: 0 };
    return pageGroundUnder(fill ? { fill } : undefined, rect, b);
  };
  const check = (
    id: string,
    color: string | undefined,
    tones: readonly (string | undefined)[],
    floor: number,
  ) => {
    const r = worstContrast(
      color ?? '',
      tones.map((t) => t ?? ''),
    );
    expect(r, `${name}: ${id} ${color} on ${tones.join(',')}`).toBeGreaterThanOrEqual(
      floor - 0.001,
    );
  };
  for (const el of els as unknown as Record<string, string>[]) {
    if (el.id === 'arrow' || el.id === 'arrow-label') {
      const from = (el as unknown as { from: { x: number; y: number } }).from;
      const tones = pageGroundUnder(fill ? { fill } : undefined, rect, {
        ...from,
        width: 180,
        height: 0,
      }).tones;
      check(el.id, el.strokeColor, tones, 3);
      continue;
    }
    const g = ground(el as unknown as Element);
    switch (el.id) {
      case 'title':
      case 'soft':
      case 'chart':
        check(el.id, el.textColor, g.tones, 3);
        break;
      case 'icon':
      case 'tick':
      case 'progress':
        check(el.id, el.strokeColor, g.tones, 3);
        if (el.textColor) check(`${el.id} label`, el.textColor, g.tones, 3);
        break;
      case 'outline':
        check(el.id, el.strokeColor, g.tones, 3);
        check(`${el.id} label`, el.textColor, g.tones, 3);
        break;
      case 'card':
      case 'navy-card':
        check(el.id, el.fillColor, [g.mean], 1.25);
        check(`${el.id} label`, el.textColor, [el.fillColor], 3);
        break;
      case 'rule':
        check(el.id, el.fillColor, g.tones, 3);
        break;
      case 'disc':
        check(el.id, el.fillColor, [g.mean], 1.25);
        break;
      case 'disc-icon':
        check(el.id, el.strokeColor, [byId(els, 'disc').fillColor], 3);
        break;
      case 'table':
        check(el.id, el.strokeColor, g.tones, 3);
        check(`${el.id} text`, el.textColor, g.tones, 3);
        break;
    }
  }
}

describe('re-inking a page', () => {
  for (const [name, fill] of Object.entries(FILLS)) {
    it(`leaves nothing under its floor on ${name}`, () => {
      const out = withPageInkFor(tabOf(sampler()), 'p', fill ? { fill } : undefined);
      expectReadable(out.elements, fill, name);
      // Idempotent: the same fill again changes nothing.
      expect(withPageInkFor(out, 'p', fill ? { fill } : undefined)).toBe(out);
    });
  }

  it('changes nothing that already reads', () => {
    const tab = tabOf([
      text('t', 20, 20, '#1e293b'),
      shape('c', 'square', 20, 100, {
        fillColor: '#e0f2fe',
        strokeColor: '#0284c7',
        label: 'x',
        textColor: '#0c4a6e',
      }),
    ]);
    expect(withPageInkFor(tab, 'p', undefined)).toBe(tab);
  });

  it('keeps text at AA, and takes text under AA, a soft heading included, to AAA', () => {
    const fill: PageFill = { kind: 'solid', color: '#ffffff' };
    const tab = tabOf([
      text('kept', 20, 20, '#2563eb'),
      text('moved', 20, 80, '#bae6fd'),
      text('soft', 20, 140, '#64748b'),
    ]);
    const out = withPageInkFor(tab, 'p', { fill });
    expect(byId(out.elements, 'kept').textColor).toBe('#2563eb');
    // Slate-500 on white is 4.76:1, so it reads; on a near-black page it is 3.6:1 and moves.
    expect(byId(out.elements, 'soft').textColor).toBe('#64748b');
    const dark = withPageInkFor(tab, 'p', { fill: { kind: 'solid', color: '#1c1917' } });
    expect(contrastRatio(byId(dark.elements, 'soft').textColor, '#1c1917')).toBeGreaterThanOrEqual(
      7,
    );
    expect(contrastRatio(byId(out.elements, 'moved').textColor, '#ffffff')).toBeGreaterThanOrEqual(
      7,
    );
  });

  it('measures text on a card against the card, not the page', () => {
    const els = [
      shape('card', 'square', 20, 20, { fillColor: '#ffffff', strokeColor: '#ffffff' }),
      text('on-card', 30, 40, '#0f172a'),
    ];
    const out = withPageInkFor(tabOf(els), 'p', { fill: FILLS.dark! });
    expect(byId(out.elements, 'on-card').textColor).toBe('#0f172a');
  });

  it('takes a sticky note as a card and leaves the note as it is', () => {
    const sticky = {
      ...createSticky(at(20, 20).x, at(20, 20).y),
      id: 'sticky',
      width: 200,
      height: 200,
      fillColor: '#fef08a',
      textColor: '#422006',
    } as Element;
    const els = [sticky, text('on-sticky', 40, 60, '#713f12')];
    const tab = tabOf(els);
    expect(withPageInkFor(tab, 'p', { fill: { kind: 'solid', color: '#fde047' } })).toBe(tab);
  });

  it('leaves what sits on a picture or a widget alone', () => {
    const image = {
      id: 'img',
      type: 'image',
      ...at(20, 20),
      width: 200,
      height: 200,
      src: 'x',
    } as unknown as Element;
    const tab = tabOf([image, text('caption', 40, 60, '#0f172a')]);
    expect(withPageInkFor(tab, 'p', { fill: FILLS.dark! })).toBe(tab);
  });

  it('leaves stickers, brand icons, highlighters and uncoloured elements as they are', () => {
    const els: Element[] = [
      shape('sticker', 'sticker', 20, 20, {
        stickerId: 'emoji-thumbs-up',
      }),
      shape('brand', 'icon', 200, 20, { iconId: 'aws-lambda', strokeColor: '#0f172a' }),
      { ...createText(at(20, 200).x, at(20, 200).y), id: 'plain', label: 'Plain' },
      shape('plain-shape', 'square', 200, 200, { label: 'Plain' }),
      {
        id: 'hl',
        type: 'freehand',
        ...at(20, 400),
        width: 100,
        height: 10,
        points: [],
        closed: false,
        pen: 'highlighter',
        strokeColor: '#0f172a',
      } as unknown as Element,
    ];
    const tab = tabOf(els);
    expect(withPageInkFor(tab, 'p', { fill: FILLS.dark! })).toBe(tab);
  });

  it('keeps a card whose border separates it', () => {
    const tab = tabOf([
      shape('c', 'square', 20, 20, {
        fillColor: '#ffffff',
        strokeColor: '#94a3b8',
        label: 'x',
        textColor: '#0f172a',
      }),
    ]);
    expect(withPageInkFor(tab, 'p', { fill: FILLS.white! })).toBe(tab);
  });

  it('nudges a vanishing card the least, keeping its hue, and its label reads on it', () => {
    const tab = tabOf([
      shape('c', 'square', 20, 20, {
        fillColor: '#1e3a8a',
        strokeColor: '#1e3a8a',
        label: 'x',
        textColor: '#93c5fd',
      }),
    ]);
    const out = withPageInkFor(tab, 'p', { fill: FILLS.navy! });
    const c = byId(out.elements, 'c');
    const r = contrastRatio(c.fillColor, '#1e3a8a');
    expect(r).toBeGreaterThanOrEqual(1.4);
    expect(r).toBeLessThan(1.6);
    expect(contrastRatio(c.textColor, c.fillColor)).toBeGreaterThanOrEqual(3);
    const { b } = hexToRgb(c.fillColor)!;
    expect(b).toBeGreaterThan(hexToRgb(c.fillColor)!.r);
  });

  it('keeps a status colour its hue', () => {
    const out = withPageInkFor(
      tabOf([shape('tick', 'icon', 20, 20, { iconId: 'check', strokeColor: '#16a34a' })]),
      'p',
      {
        fill: { kind: 'solid', color: '#15803d' },
      },
    );
    const { r, g, b } = hexToRgb(byId(out.elements, 'tick').strokeColor)!;
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('re-inks a labelled arrow with no text colour of its own to AA', () => {
    const arrow = {
      ...createArrow(at(20, 20).x, at(20, 20).y, at(200, 20).x, at(200, 20).y),
      id: 'a',
      label: 'Yes',
      strokeColor: '#334155',
    } as Element;
    const out = withPageInkFor(tabOf([arrow]), 'p', { fill: FILLS.dark! });
    expect(contrastRatio(byId(out.elements, 'a').strokeColor, '#0f172a')).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('re-inks locked elements and elements on a locked layer', () => {
    const layers = [{ id: 'l1', name: 'Base', locked: true }];
    const els = [
      { ...text('locked', 20, 20, '#1e293b'), locked: true } as Element,
      { ...text('layered', 20, 80, '#1e293b'), layerId: 'l1' } as Element,
    ];
    const out = withPageInkFor(tabOf(els, { layers }), 'p', { fill: FILLS.dark! });
    for (const id of ['locked', 'layered']) {
      expect(contrastRatio(byId(out.elements, id).textColor, '#0f172a')).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('touches only the page whose fill changed', () => {
    const pages = [{ ...PAGE }, { id: 'q', orientation: 'portrait' as const }];
    const second = layOutPages(pages)[1]!.rect;
    const other = {
      ...createText(second.x + 20, second.y + 20),
      id: 'other',
      label: 'x',
      textColor: '#1e293b',
    } as Element;
    const tab = { elements: [other], pages };
    expect(withPageInkFor(tab, 'p', { fill: FILLS.dark! })).toBe(tab);
    expect(withPageInkFor(tab, 'missing', { fill: FILLS.dark! })).toBe(tab);
  });
});

describe('no colour of its own', () => {
  const pale = { fillColor: '#f0f9ff', strokeColor: '#bae6fd' };
  const els = (): Element[] => [
    shape('card', 'square', 20, 20, { ...pale, label: '' }),
    {
      ...createText(at(30, 40).x, at(30, 40).y),
      id: 'sub',
      width: 60,
      height: 20,
      label: 'Customers',
    },
    shape('disc', 'circle', 200, 20, { ...pale, label: '' }),
    shape('glyph', 'icon', 230, 50, { iconId: 'server', width: 20, height: 20 }),
    shape('labelled', 'square', 20, 200, { ...pale, label: 'Plain label' }),
    { ...createText(at(20, 400).x, at(20, 400).y), id: 'free', label: 'On the page' },
  ];

  it("takes its card's ink when the page's ink would vanish on the card, and gives it back", () => {
    const tab = tabOf(els());
    const dark = pageInkFor(tab, 'p', { fill: FILLS.dark! });
    const sub = byId(dark.tab.elements, 'sub');
    expect(contrastRatio(sub.textColor, pale.fillColor)).toBeGreaterThanOrEqual(4.5);
    // The dark page's icon ink (slate-500) already reads on the pale disc: left to follow the page.
    expect(byId(dark.tab.elements, 'glyph').strokeColor).toBeUndefined();
    expect(
      contrastRatio(
        defaultStrokeColor(byId(dark.tab.elements, 'glyph') as unknown as ShapeElement, 'dark'),
        pale.fillColor,
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(byId(dark.tab.elements, 'labelled').textColor, pale.fillColor),
    ).toBeGreaterThanOrEqual(4.5);
    // On the page itself it still follows the page.
    expect('textColor' in byId(dark.tab.elements, 'free')).toBe(false);
    const back = pageInkFor(dark.tab, 'p', undefined, dark.memory);
    expect(back.tab.elements).toEqual(tab.elements);
    for (const el of back.tab.elements) {
      if (['sub', 'glyph', 'labelled', 'free'].includes(el.id)) {
        expect('textColor' in el && el.id !== 'labelled').toBe(false);
      }
    }
    expect(back.memory.size).toBe(0);
  });

  it("writes a stat row's captions and figures for its cards", () => {
    const row = shape('row', 'stat-row', 20, 20, {
      ...pale,
      strokeColor: '#0ea5e9',
      width: 300,
      stats: [{ value: '12k', caption: 'Customers' }],
    });
    const dark = pageInkFor(tabOf([row]), 'p', { fill: FILLS.dark! });
    const out = byId(dark.tab.elements, 'row');
    expect(out.fillColor).toBe(pale.fillColor);
    expect(contrastRatio(out.textColor, pale.fillColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out.strokeColor, pale.fillColor)).toBeGreaterThanOrEqual(3);
    const back = pageInkFor(dark.tab, 'p', undefined, dark.memory);
    expect('textColor' in byId(back.tab.elements, 'row')).toBe(false);
  });

  it("is left alone where the page's ink reads on the card", () => {
    const tab = tabOf(els());
    expect(withPageInkFor(tab, 'p', { fill: FILLS.pale! })).toBe(tab);
  });

  // The page's own ink is made for a near-white or near-black paper: on a mid-tone fill it can
  // vanish (slate-500 on teal is 1.15:1, sky on yellow 1.8:1), so it is judged there too.
  const straight = (): Element[] => [
    shape('glyph', 'icon', 20, 20, { iconId: 'server', width: 40, height: 40 }),
    shape('bar', 'progress-bar', 20, 100, { height: 16, width: 200 }),
    shape('outline', 'square', 20, 200, { fillColor: 'transparent', label: 'Outlined' }),
    { ...createText(at(20, 400).x, at(20, 400).y), id: 'free', label: 'On the page' },
  ];
  const ON_PAGE = ['glyph', 'bar', 'outline'];
  const hueOf = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return null;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it.each([
    ['teal', '#0f766e', 'dark'],
    ['red', '#b91c1c', 'dark'],
    ['deep blue', '#1e3a8a', 'dark'],
    ['yellow', '#facc15', 'light'],
  ] as const)(
    "lifts the page's ink where it vanishes on a %s page, keeping its hue",
    (_, color, surface) => {
      const tab = tabOf(straight());
      const out = pageInkFor(tab, 'p', { fill: { kind: 'solid', color } });
      for (const id of ON_PAGE) {
        const el = byId(out.tab.elements, id);
        const drawn = defaultStrokeColor(el as unknown as ShapeElement, surface);
        const now = el.strokeColor ?? drawn;
        expect(contrastRatio(now, color), id).toBeGreaterThanOrEqual(3);
        if (el.strokeColor) expect(hueOf(el.strokeColor), id).toBeCloseTo(hueOf(drawn)!, -1);
      }
      const free = byId(out.tab.elements, 'free');
      const freeInk = free.textColor ?? defaultTextColor(free as unknown as TextElement, surface);
      expect(contrastRatio(freeInk, color)).toBeGreaterThanOrEqual(3);
      // Back to the paper: no colour of its own again.
      const back = pageInkFor(out.tab, 'p', undefined, out.memory);
      expect(back.tab.elements).toEqual(tab.elements);
      expect(back.memory.size).toBe(0);
    },
  );

  it("leaves the page's ink alone where it reads, and on the plain paper", () => {
    const tab = tabOf(straight());
    expect(withPageInkFor(tab, 'p', { fill: { kind: 'solid', color: '#0f172a' } })).toBe(tab);
    expect(withPageInkFor(tab, 'p', { fill: { kind: 'solid', color: '#ffffff' } })).toBe(tab);
    expect(withPageInkFor(tab, 'p', undefined)).toBe(tab);
  });

  it('judges a gradient at its worst point under the element', () => {
    const tab = tabOf(straight());
    const fill: PageFill = { kind: 'gradient', from: '#0f766e', to: '#134e4a', angle: 180 };
    const out = pageInkFor(tab, 'p', { fill });
    for (const id of ON_PAGE) {
      const el = byId(out.tab.elements, id);
      const box = el as unknown as { x: number; y: number; width: number; height: number };
      const { tones } = pageGroundUnder({ fill }, rect, box);
      const now = el.strokeColor ?? defaultStrokeColor(el as unknown as ShapeElement, 'dark');
      expect(worstContrast(now, tones), id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('going back', () => {
  it('restores every colour when the page returns to a fill it read on', () => {
    // The author's colours all read on white; a tour of fills and back gives them back exactly.
    const start = tabOf([
      text('t', 20, 20, '#1e293b'),
      shape('i', 'icon', 200, 20, { iconId: 'server', strokeColor: '#0369a1' }),
      shape('c', 'square', 20, 120, {
        fillColor: '#ffffff',
        strokeColor: '#94a3b8',
        label: 'x',
        textColor: '#0f172a',
      }),
      shape('n', 'square', 200, 120, {
        fillColor: '#1e3a8a',
        strokeColor: '#1e3a8a',
        label: 'x',
        textColor: '#e0e7ff',
      }),
    ]);
    let memory: InkMemory | undefined;
    let tab = start;
    for (const fill of [FILLS.dark, FILLS.sunrise, FILLS.navy, FILLS.white]) {
      const out = pageInkFor(tab, 'p', fill ? { fill } : undefined, memory);
      tab = out.tab;
      memory = out.memory;
    }
    expect(tab.elements).toEqual(start.elements);
    expect(memory!.size).toBe(0);
  });

  it('lands where the author colours re-inked straight onto the fill would, whatever came between', () => {
    const start = tabOf(sampler());
    let memory: InkMemory | undefined;
    let tab = start;
    for (const fill of [FILLS.dark, FILLS.sunrise, FILLS.navy, undefined]) {
      const out = pageInkFor(tab, 'p', fill ? { fill } : undefined, memory);
      tab = out.tab;
      memory = out.memory;
    }
    expect(tab.elements).toEqual(withPageInkFor(start, 'p', undefined).elements);
  });

  it('re-inks from the author colour, not the last re-ink, so colours never drift', () => {
    let memory: InkMemory | undefined;
    let tab = tabOf(sampler());
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      for (const fill of [FILLS.dark, FILLS.yellow]) {
        const out = pageInkFor(tab, 'p', { fill: fill! }, memory);
        tab = out.tab;
        memory = out.memory;
      }
      seen.push(JSON.stringify(tab.elements));
    }
    expect(new Set(seen).size).toBe(1);
  });

  it('forgets a colour someone changed since', () => {
    const tab = tabOf([text('t', 20, 20, '#1e293b')]);
    const dark = pageInkFor(tab, 'p', { fill: FILLS.dark! });
    const recoloured = {
      ...dark.tab,
      elements: dark.tab.elements.map((e) => ({ ...e, textColor: '#fbbf24' })),
    };
    const back = pageInkFor(recoloured, 'p', undefined, dark.memory);
    expect(byId(back.tab.elements, 't').textColor).not.toBe('#1e293b');
    expect(contrastRatio(byId(back.tab.elements, 't').textColor, '#ffffff')).toBeGreaterThanOrEqual(
      4.5,
    );
    // Remembered from the new colour, never the old one.
    expect(back.memory.get('t')?.textColor?.from).toBe('#fbbf24');
  });

  it('drops the memory of elements no longer on the tab', () => {
    const dark = pageInkFor(tabOf([text('t', 20, 20, '#1e293b')]), 'p', { fill: FILLS.dark! });
    expect(dark.memory.size).toBe(1);
    const gone = pageInkFor(
      tabOf([text('u', 20, 20, '#f8fafc')]),
      'p',
      { fill: FILLS.dark! },
      dark.memory,
    );
    expect(gone.memory.size).toBe(0);
  });
});

describe('several pages in one walk', () => {
  const pages = [{ ...PAGE }, { id: 'q', orientation: 'portrait' as const }];
  const second = layOutPages(pages)[1]!.rect;
  const onSecond = {
    ...createText(second.x + 20, second.y + 20),
    id: 'q-text',
    width: 120,
    height: 30,
    label: 'Hi',
    textColor: '#1e293b',
  } as Element;
  const tab = { elements: [text('t', 20, 20, '#1e293b'), onSecond], pages };

  it('inks each page as pageInkFor would, one after the other, with one memory', () => {
    const one = pageInkFor(tab, 'p', { fill: FILLS.dark! });
    const both = pageInkFor(one.tab, 'q', { fill: FILLS.steep! }, one.memory);
    const walk = pagesInkFor(tab, [
      { pageId: 'p', background: { fill: FILLS.dark! } },
      { pageId: 'q', background: { fill: FILLS.steep! } },
    ]);
    expect(walk.tab.elements).toEqual(both.tab.elements);
    expect([...walk.memory]).toEqual([...both.memory]);
  });

  it('is the same tab for no pages, a missing page, or a page with nothing on it', () => {
    expect(pagesInkFor(tab, []).tab).toBe(tab);
    const missing = pagesInkFor(tab, [{ pageId: 'missing', background: { fill: FILLS.dark! } }]);
    expect(missing.tab).toBe(tab);
    const bare = { elements: [], pages };
    expect(pagesInkFor(bare, [{ pageId: 'q', background: { fill: FILLS.dark! } }]).tab).toBe(bare);
  });

  it('judges a page named twice from what its first pass left', () => {
    const twice = pagesInkFor(tab, [
      { pageId: 'p', background: { fill: FILLS.dark! } },
      { pageId: 'p', background: undefined },
    ]);
    // Back on the paper, the author's colour returns.
    expect(byId(twice.tab.elements, 't').textColor).toBe('#1e293b');
  });
});

describe('re-inking as part of the fill edit', () => {
  it('is one edit: the new fill and the re-inked content in one tab, with its memory', () => {
    const tab = tabOf([text('t', 20, 20, '#1e293b')]);
    const out = pageBackgroundSet(tab, 'p', { fill: FILLS.dark });
    if (!('tab' in out)) throw new Error('refused');
    expect(pagesOf(out.tab)[0]!.background?.fill).toEqual(FILLS.dark);
    expect(contrastRatio(byId(out.tab.elements, 't').textColor, '#0f172a')).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(out.memory!.size).toBe(1);
    const back = pageBackgroundSet(out.tab, 'p', { fill: undefined }, out.memory);
    if (!('tab' in back)) throw new Error('refused');
    expect(byId(back.tab.elements, 't').textColor).toBe('#1e293b');
  });

  it('a pattern alone re-inks nothing', () => {
    const tab = tabOf([text('t', 20, 20, '#f8fafc')]);
    const out = pageBackgroundSet(tab, 'p', { pattern: 'dots' });
    if (!('tab' in out)) throw new Error('refused');
    expect(out.tab.elements).toBe(tab.elements);
    expect(out.memory).toBeUndefined();
  });
});

describe('re-inking cost', () => {
  it('re-inks a crowded page well within a hover frame budget', () => {
    const els: Element[] = [];
    for (let i = 0; i < 600; i += 1) {
      const dx = (i % 20) * 20;
      const dy = Math.floor(i / 20) * 25;
      els.push(
        i % 3 === 0
          ? shape(`s${i}`, 'square', dx, dy, {
              fillColor: '#ffffff',
              strokeColor: '#ffffff',
              label: 'x',
              textColor: '#e2e8f0',
              width: 18,
              height: 20,
            })
          : text(`t${i}`, dx, dy, '#cbd5e1'),
      );
    }
    const tab = tabOf(els);
    const t0 = performance.now();
    withPageInkFor(tab, 'p', { fill: FILLS.steep! });
    const ms = performance.now() - t0;
    // Measured 44 ms on an M-series Mac (every element re-inked, the worst case); the budget leaves room for a loaded CI runner.
    expect(ms).toBeLessThan(1500);
  });
});
