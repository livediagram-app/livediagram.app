import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, type Element } from '@livediagram/document';
import { templateCanvasOverrides } from '@livediagram/templates';
import { buildTemplate } from './template-builders';

// Structure pins for the design starters redesigned together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the mobile and web page wireframes,
// the slide deck, the storyboard and the floor plan. Each test maps to a
// sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };
const shapesOf = (els: Element[], shape: string) =>
  els.filter((el) => el.type === 'shape' && el.shape === shape) as Shape[];
const labelOf = (el: Element) => (el as { label?: string }).label ?? '';
const labels = (els: Element[]) => els.map(labelOf).filter(Boolean);
const byId = (els: Element[], id: string) => els.find((el) => el.id === id) as Box | undefined;
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const contains = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

// The annotation grammar the two wireframes share: numbered bold pins on the
// UI, each matched by an amber note in the rail.
const pinsOf = (els: Element[]) =>
  shapesOf(els, 'circle').filter((c) => /^\d$/.test(labelOf(c)) && c.colorPreset === 'bold');
const notesOf = (els: Element[]) => els.filter((el) => el.type === 'sticky');

describe('mobile wireframe template', () => {
  const els = buildTemplate('mobile-wireframe', 0, 0);
  const phones = shapesOf(els, 'phone');

  it('tells one flow across three named phones', () => {
    expect(phones.map(labelOf)).toEqual(['1 · Menu', '2 · Customise', '3 · Order placed']);
    expect(labels(els)).toContain('Order-ahead coffee · mobile flow');
  });

  it('joins each screen to the next with a Tap arrow from the control that moves on', () => {
    const arrows = els.filter(
      (el): el is Extract<Element, { type: 'arrow' }> => el.type === 'arrow',
    );
    expect(arrows).toHaveLength(2);
    arrows.forEach((arrow, i) => {
      expect(arrow.label).toBe('Tap');
      if (arrow.from.kind !== 'pinned' || arrow.to.kind !== 'pinned') throw new Error('free');
      // Leaves a control on screen i, lands on the west side of phone i + 1.
      expect(inside(byId(els, arrow.from.elementId)!, phones[i]!)).toBe(true);
      expect(arrow.to.elementId).toBe(phones[i + 1]!.id);
      expect(arrow.to.anchor).toBe('w');
    });
    expect(
      labelOf(els.find((el) => el.id === (arrows[1]!.from as { elementId: string }).elementId)!),
    ).toBe('Add to order · £3.40');
  });

  it('marks the chosen size, and offers extras as a checklist and status as a process', () => {
    const soft = shapesOf(els, 'stadium').filter((s) =>
      ['Small', 'Regular', 'Large'].includes(labelOf(s)),
    );
    expect(soft.filter((s) => s.colorPreset === 'soft').map(labelOf)).toEqual(['Regular']);
    expect(shapesOf(els, 'checklist')[0]!.checklistItems).toHaveLength(3);
    expect(shapesOf(els, 'process')[0]!.processSteps).toEqual(['Placed', 'Brewing', 'Ready']);
  });

  it('numbers five pins on the phones and matches each with an amber note', () => {
    const pins = pinsOf(els);
    const onPhones = pins.filter((p) => phones.some((ph) => contains(ph, centre(p))));
    expect(onPhones.map(labelOf).sort()).toEqual(['1', '2', '3', '4', '5']);
    const notes = notesOf(els);
    expect(notes).toHaveLength(5);
    expect(notes.every((n) => (n as { fillColor?: string }).fillColor === '#fde68a')).toBe(true);
    // The rail repeats each number beside its note.
    const railPins = pins.filter((p) => !onPhones.includes(p));
    expect(railPins.map(labelOf)).toEqual(['1', '2', '3', '4', '5']);
    expect(labels(els)).toContain('Notes');
  });
});

describe('web page wireframe template', () => {
  const els = buildTemplate('browser-wireframe', 0, 0);
  const browser = shapesOf(els, 'browser')[0]!;

  it('lays out a real landing page: one CTA label in nav and hero, a product shot with numbers', () => {
    const ctas = shapesOf(els, 'stadium').filter((s) => labelOf(s) === 'Start free trial');
    expect(ctas).toHaveLength(2);
    expect(ctas.every((c) => c.colorPreset === 'bold')).toBe(true);
    expect(shapesOf(els, 'bar-chart')[0]!.pieSlices!.length).toBeGreaterThanOrEqual(4);
    for (const l of ['pocketbook.app', 'Book a demo', 'Snap a receipt', 'Invoices that chase'])
      expect(labels(els)).toContain(l);
    // Three benefit cards, each led by a line-art glyph.
    const glyphs = shapesOf(els, 'icon').filter((i) =>
      ['camera', 'send', 'pie-chart'].includes(i.iconId ?? ''),
    );
    expect(glyphs).toHaveLength(3);
  });

  it('pins five decisions on the page and explains them in the notes rail', () => {
    const pins = pinsOf(els);
    const onPage = pins.filter((p) => contains(browser, centre(p)));
    expect(onPage.map(labelOf)).toEqual(['1', '2', '3', '4', '5']);
    expect(notesOf(els)).toHaveLength(5);
    // The rail sits beside the frame, not over the page.
    for (const note of notesOf(els))
      expect((note as Box).x).toBeGreaterThan(browser.x + browser.width);
  });
});

describe('slide deck template', () => {
  // The slides are Illustrate pages (canvas-and-palette.md "Templates on pages"), not drawn cards.
  const els = buildTemplate('slide-deck', 0, 0);
  const slides = layOutIllustratePages(templateCanvasOverrides('slide-deck').pages!).map(
    (p) => p.rect,
  );
  const onSlide = (i: number) => els.filter((el) => contains(slides[i]!, centre(el as Box)));

  it('lays six 16:9 slides in a row, read left to right', () => {
    expect(slides).toHaveLength(6);
    for (const s of slides) expect(s.width / s.height).toBeCloseTo(16 / 9, 1);
    for (let i = 1; i < slides.length; i++) expect(slides[i]!.x).toBeGreaterThan(slides[i - 1]!.x);
    expect(shapesOf(els, 'square').some((s) => s.width === 520)).toBe(false);
    expect(els.filter((el) => el.type === 'arrow')).toHaveLength(0);
  });

  it('follows the pitch arc, one kicker per slide, with a page number on each after the title', () => {
    const kickers = ['The problem', 'The solution', 'Traction', 'The team', 'The ask'];
    kickers.forEach((kicker, i) => expect(labels(onSlide(i + 1))).toContain(kicker));
    for (let n = 2; n <= 6; n++) expect(labels(onSlide(n - 1))).toContain(`${n} / 6`);
  });

  it('builds each body from the element that suits it', () => {
    for (const kind of ['circle', 'stat-row', 'line-chart', 'pie-chart', 'icon', 'sticker'])
      expect(shapesOf(els, kind).length, kind).toBeGreaterThan(0);
  });

  it('carries the speaker notes on every slide’s headline', () => {
    for (let i = 0; i < slides.length; i++) {
      const noted = onSlide(i).filter((el) => (el as { note?: string }).note);
      expect(noted, `slide ${i + 1}`).toHaveLength(1);
      expect(noted[0]!.type).toBe('text');
    }
  });
});

describe('storyboard template', () => {
  const els = buildTemplate('storyboard', 0, 0);
  const panels = shapesOf(els, 'square').filter((s) => s.width === 360);

  it('draws six 16:9 panels, each with a number chip and a shot + timing chip', () => {
    expect(panels).toHaveLength(6);
    for (const p of panels) expect(p.width / p.height).toBeCloseTo(16 / 9, 1);
    const chips = shapesOf(els, 'stadium').filter((s) => / · 0:\d\d$/.test(labelOf(s)));
    expect(chips).toHaveLength(6);
    expect(chips.every((c) => c.colorPreset === 'soft')).toBe(true);
    for (const [i, p] of panels.entries()) expect(inside(chips[i]!, p)).toBe(true);
  });

  it('captions every panel with an action line and a muted sound line', () => {
    const sounds = els.filter(
      (el) => el.type === 'text' && el.textItalic && /^(SFX|VO|Music):/.test(labelOf(el)),
    );
    expect(sounds).toHaveLength(6);
  });

  it('sketches with glyphs and stickers, and gives dialogue a speech bubble', () => {
    expect(shapesOf(els, 'icon').length).toBeGreaterThan(6);
    expect(shapesOf(els, 'sticker').length).toBeGreaterThan(3);
    expect(shapesOf(els, 'speech-bubble').map(labelOf)).toEqual(['Not again…', 'Made it, early!']);
  });
});

describe('floor plan template', () => {
  const els = buildTemplate('floor-plan', 0, 0);
  const squares = shapesOf(els, 'square');
  const rooms = squares.filter((s) => s.opacity === undefined);
  const washes = squares.filter((s) => s.opacity !== undefined);

  it('says what it draws: two bedrooms and a study', () => {
    expect(labels(els).some((l) => l.startsWith('Floor plan · two-bed flat with study'))).toBe(
      true,
    );
    const captions = labels(els).filter((l) => / m²$/.test(l) && !l.startsWith('Floor plan'));
    expect(captions.filter((c) => /bedroom/i.test(c))).toHaveLength(2);
    expect(captions.some((c) => c.startsWith('Study'))).toBe(true);
  });

  it('washes every room in its zone colour, translucent and theme-locked', () => {
    expect(washes).toHaveLength(rooms.length);
    for (const w of washes) {
      expect(w.themeLockFill).toBe(true);
      expect(w.opacity).toBeLessThan(0.5);
      expect(rooms.some((r) => r.x === w.x && r.y === w.y && r.width === w.width)).toBe(true);
    }
    // The key's legend names every zone colour the washes use.
    const legend = shapesOf(els, 'legend')[0]!;
    const legendColours = new Set(legend.legendItems!.map((i) => i.color));
    for (const w of washes) expect(legendColours.has(w.fillColor)).toBe(true);
  });

  it('dimensions the north and west walls, spans summing to the flat', () => {
    const spans = els
      .filter((el) => el.type === 'arrow' && /^\d+\.\d m$/.test(labelOf(el)))
      .map((el) => el as Extract<Element, { type: 'arrow' }>);
    const along = (horizontal: boolean) =>
      spans
        .filter((a) => a.from.kind === 'free' && a.to.kind === 'free')
        .filter((a) => {
          const f = a.from as { x: number; y: number };
          const t = a.to as { x: number; y: number };
          return horizontal ? f.y === t.y : f.x === t.x;
        })
        .reduce((sum, a) => sum + parseFloat(labelOf(a)), 0);
    expect(along(true)).toBeCloseTo(10.2, 5);
    expect(along(false)).toBeCloseTo(7.4, 5);
  });

  it('carries a north arrow, a 1 m scale bar and a symbol key', () => {
    const l = labels(els);
    expect(l).toContain('N');
    expect(shapesOf(els, 'icon').some((i) => i.iconId === 'arrow-up')).toBe(true);
    expect(els.some((el) => el.type === 'arrow' && labelOf(el) === '1 m')).toBe(true);
    for (const s of ['Zones', 'Symbols', 'Door and its swing', 'Bath', 'Hob'])
      expect(l).toContain(s);
  });
});
