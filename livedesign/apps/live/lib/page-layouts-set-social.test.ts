import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement, TextElement } from '@livepages/document';
import { PAGE_LAYOUTS } from '@livepages/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the further Social layouts, posts built
// first for Square, Portrait post (4:5) and Story (9:16) pages, a wide page setting the picture,
// chart or tiles beside the words.
const SQUARE = { x: 0, y: 0, width: 928, height: 928 };
const POST = { x: 0, y: 0, width: 928, height: 1174 };
const STORY = { x: 0, y: 0, width: 928, height: 1768 };
const LANDSCAPE = { x: 0, y: 0, width: 1174, height: 928 };
const WIDESCREEN = { x: 0, y: 0, width: 1768, height: 928 };
const ALL = [SQUARE, POST, STORY, LANDSCAPE, WIDESCREEN];

const IDS = [
  'carousel-cover',
  'tip-of-the-day',
  'milestone',
  'behind-the-scenes',
  'countdown',
  'product-spotlight',
  'giveaway',
  'welcome',
  'webinar',
] as const;

const layout = (id: string) => {
  const l = PAGE_LAYOUTS.find((p) => p.id === id);
  if (!l) throw new Error(`no layout ${id}`);
  return l;
};
const shapes = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);
const texts = (els: Element[]) => els.filter((e): e is TextElement => e.type === 'text');
const images = (els: Element[]) => els.filter((e) => e.type === 'image');
const labels = (els: Element[]) =>
  els.flatMap((e) => ('label' in e && typeof e.label === 'string' ? [e.label] : []));
const has = (els: Element[], label: string) => labels(els).includes(label);

describe('Social set layouts', () => {
  it('fill the Social category to twelve', () => {
    for (const id of IDS) expect(layout(id).category).toBe('social');
    expect(PAGE_LAYOUTS.filter((l) => l.category === 'social')).toHaveLength(12);
  });

  for (const id of IDS) {
    it(`${id} sets its headline large and its body above the large preset on a post`, () => {
      for (const box of ALL) {
        const els = layout(id).build(box);
        const headline = Math.max(...texts(els).map((t) => t.textScale ?? 1));
        expect(headline).toBeGreaterThanOrEqual(1.8);
        // Body type is never the small preset.
        for (const t of texts(els)) expect(t.textSize).not.toBe('sm');
      }
    });

    it(`${id} keeps every element at a positive size on every post shape`, () => {
      for (const box of ALL) {
        for (const el of layout(id).build(box)) {
          if (el.type === 'arrow') continue;
          expect(el.width).toBeGreaterThan(0);
          expect(el.height).toBeGreaterThan(0);
        }
      }
    });
  }

  it('Carousel Cover: a stacked hook, a slide count and a swipe cue', () => {
    const story = layout('carousel-cover').build(STORY);
    expect(has(story, '1 / 7')).toBe(true);
    expect(has(story, 'Swipe for all 7')).toBe(true);
    // Four lines on a tall page, three on a wide one.
    expect(['7 habits', 'of calm,', 'focused', 'teams'].every((l) => has(story, l))).toBe(true);
    const wide = layout('carousel-cover').build(WIDESCREEN);
    expect(['7 habits of', 'calm, focused', 'teams'].every((l) => has(wide, l))).toBe(true);
    expect(shapes(wide, 'icon').some((i) => i.iconId === 'arrow-right')).toBe(true);
  });

  it('Tip of the Day: three reasons, on a card beside the tip when wide', () => {
    const tall = layout('tip-of-the-day').build(POST);
    expect(has(tall, '#12')).toBe(true);
    expect(shapes(tall, 'icon')).toHaveLength(4); // three reasons and the bookmark
    const wide = layout('tip-of-the-day').build(LANDSCAPE);
    const card = shapes(wide, 'square').find((s) => s.borderRadius === 'lg');
    expect(card).toBeDefined();
    const tip = texts(wide).find((t) => t.label === 'Check email')!;
    expect(card!.x).toBeGreaterThan(tip.x + tip.width - 1);
  });

  it('Milestone: the climb charted with its source where there is room, never on a square', () => {
    for (const box of [STORY, LANDSCAPE, WIDESCREEN]) {
      const els = layout('milestone').build(box);
      expect(shapes(els, 'line-chart')).toHaveLength(1);
      expect(labels(els).some((l) => l.includes('Source:'))).toBe(true);
    }
    expect(shapes(layout('milestone').build(SQUARE), 'line-chart')).toHaveLength(0);
  });

  it('Behind the Scenes: three photos, each naming its step', () => {
    for (const box of ALL) {
      const els = layout('behind-the-scenes').build(box);
      // Three photos and the handle's avatar.
      expect(images(els)).toHaveLength(4);
      expect(['1. Cutting', '2. Stitching', '3. Packing'].every((l) => has(els, l))).toBe(true);
    }
  });

  it('Countdown: three tiles, in a row under the title or beside it when wide', () => {
    const tall = layout('countdown').build(STORY);
    const tiles = (els: Element[]) => shapes(els, 'square').filter((s) => s.borderRadius === 'lg');
    expect(tiles(tall)).toHaveLength(3);
    expect(new Set(tiles(tall).map((t) => t.y)).size).toBe(1);
    const wide = layout('countdown').build(WIDESCREEN);
    expect(Math.min(...tiles(wide).map((t) => t.x))).toBeGreaterThan(WIDESCREEN.width * 0.4);
  });

  it('Product Spotlight: a price badge over the photo, a rating and Shop now', () => {
    for (const box of ALL) {
      const els = layout('product-spotlight').build(box);
      expect(has(els, '£48')).toBe(true);
      expect(shapes(els, 'rating')).toHaveLength(1);
      expect(has(els, 'Shop now')).toBe(true);
    }
  });

  it('Giveaway: a WIN star, three numbered steps and the small print', () => {
    for (const box of ALL) {
      const els = layout('giveaway').build(box);
      expect(shapes(els, 'star')).toHaveLength(1);
      expect(['1', '2', '3'].every((n) => has(els, n))).toBe(true);
      expect(labels(els).some((l) => l.startsWith('Ends'))).toBe(true);
    }
  });

  it('Welcome Aboard: a round photo, a name, a role and three facts', () => {
    for (const box of ALL) {
      const els = layout('welcome').build(box);
      expect(images(els).some((i) => 'borderRadius' in i && i.borderRadius === 'full')).toBe(true);
      expect(has(els, 'Priya Shah')).toBe(true);
      expect(['From Leeds', 'Loves bouldering', 'Kerning nerd'].every((l) => has(els, l))).toBe(
        true,
      );
    }
  });

  it('Webinar: when and where, the host, and Save your seat', () => {
    for (const box of ALL) {
      const els = layout('webinar').build(box);
      expect(has(els, 'Dr Lena Fischer')).toBe(true);
      expect(has(els, 'Save your seat')).toBe(true);
      expect(
        ['calendar', 'clock', 'monitor'].every((id) =>
          shapes(els, 'icon').some((i) => i.iconId === id),
        ),
      ).toBe(true);
    }
  });
});
