// A page's content carried into a new layout (docs/specs/007-editor/pages-mode.md "Content
// carries over").
import { describe, expect, it } from 'vitest';
import {
  createImage,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ImageElement,
  type ShapeElement,
  type TextElement,
} from '@livedesign/document';
import { pageLayoutById } from './layout-catalogue';
import { carryPageContent, warmLayoutPlaceholders } from './page-layout-carry';
import type { PageLayoutId } from './page-layouts';

const TALL = { x: 0, y: 0, width: 700, height: 990 };
const build = (id: PageLayoutId) => pageLayoutById(id).build(TALL);

const text = (y: number, label: string, extra: Partial<TextElement> = {}): TextElement => ({
  ...createText(0, y),
  width: 600,
  height: 60,
  label,
  textSize: 'md',
  ...extra,
});
const image = (y: number, w: number, h: number, imageId: string | null): ImageElement => ({
  ...createImage(0, y),
  width: w,
  height: h,
  imageId,
});
const texts = (els: readonly Element[]) =>
  els.filter((el): el is TextElement => el.type === 'text');
const labels = (els: readonly Element[]) => texts(els).map((el) => el.label);
const relabel = (els: Element[], from: string, to: string) =>
  els.map((el) => (el.type === 'text' && el.label === from ? { ...el, label: to } : el));

describe('carryPageContent', () => {
  it('leaves another layout untouched: placeholders stay behind', () => {
    const placed = build('poster');
    expect(carryPageContent(build('title'), placed)).toEqual(placed);
  });

  it('keeps the new layout ids, so its pinned arrows hold', () => {
    const placed = build('process');
    const out = carryPageContent(
      relabel(build('title'), 'Your big headline', 'Q3 Results'),
      placed,
    );
    expect(out.map((el) => el.id)).toEqual(placed.map((el) => el.id));
    expect(out.filter((el) => el.type === 'arrow')).toEqual(
      placed.filter((el) => el.type === 'arrow'),
    );
  });

  it('carries a title page into a poster: title, lead and picture', () => {
    let page = relabel(build('title'), 'Your big headline', 'Q3 Results');
    page = relabel(
      page,
      'One line on what this page shows, and why it matters.',
      'Revenue grew in every region.',
    );
    page = page.map((el) => (el.type === 'image' ? { ...el, imageId: 'photo-1' } : el));
    const placed = build('poster');
    const out = carryPageContent(page, placed);
    const title = texts(out).find((el) => el.label === 'Q3 Results')!;
    // In the poster's headline place, with its look.
    const headline = texts(placed).find((el) => el.label === 'Make it bold')!;
    expect(title.id).toBe(headline.id);
    expect(title.y).toBe(headline.y);
    expect(labels(out)).toContain('Revenue grew in every region.');
    const picture = out.find((el): el is ImageElement => el.type === 'image')!;
    expect(picture.imageId).toBe('photo-1');
    expect(picture.objectFit).toBe('cover');
  });

  it('matches words by role, each role in reading order', () => {
    const prev = [
      text(0, 'Old title', { textSize: 'lg', textScale: 2 }),
      text(100, 'Old lead', { textSize: 'lg' }),
      text(200, 'Body one'),
      text(300, 'Body two'),
    ];
    const placed = [
      text(500, 'second body'),
      text(400, 'first body'),
      text(0, 'Lead slot', { textSize: 'lg', y: 300 }),
      text(10, 'Title slot', { textSize: 'lg', textScale: 3 }),
    ];
    expect(labels(carryPageContent(prev, placed))).toEqual([
      'Body two',
      'Body one',
      'Old lead',
      'Old title',
    ]);
  });

  it('keeps figures for figures', () => {
    const prev = [text(0, 'Headline words', { textSize: 'lg', textScale: 2 }), text(100, '42%')];
    const placed = [text(0, '73%', { textSize: 'lg', textScale: 5 }), text(200, 'slot')];
    const out = labels(carryPageContent(prev, placed));
    expect(out[0]).toBe('42%');
    // The headline found no title, so it took the body place.
    expect(out[1]).toBe('Headline words');
  });

  it('sends leftover words to the nearest role with room', () => {
    const prev = [text(0, 'One'), text(100, 'Two'), text(200, 'Three')];
    const placed = [
      text(0, 'Title slot', { textSize: 'lg', textScale: 2 }),
      text(100, 'body slot'),
    ];
    // Body first into body, then large (none), then the title.
    expect(labels(carryPageContent(prev, placed))).toEqual(['Two', 'One']);
  });

  it('drops what finds no place', () => {
    const prev = [image(0, 100, 100, 'a'), text(0, 'Words')];
    const placed = [createShape('square', 0, 0)];
    expect(carryPageContent(prev, placed)).toEqual(placed);
  });

  it('carries the largest picture into the largest place, empty placeholders not at all', () => {
    const prev = [image(0, 100, 100, 'small'), image(0, 400, 400, 'big'), image(0, 900, 900, null)];
    const placed = [image(0, 50, 50, null), image(0, 600, 300, null)];
    const out = carryPageContent(prev, placed) as ImageElement[];
    expect(out.map((el) => el.imageId)).toEqual(['small', 'big']);
    expect(out[1]!.width).toBe(600);
  });

  it('carries a shape data into the next shape of its kind, untouched ones not at all', () => {
    const stats = [{ value: '9', caption: 'Mine' }];
    const edited: ShapeElement = { ...createShape('stat-row', 0, 0), stats };
    const untouched = build('key-stats').find(
      (el): el is ShapeElement => el.type === 'shape' && el.shape === 'stat-row',
    )!;
    const slot: ShapeElement = { ...createShape('stat-row', 50, 400), width: 640 };
    const second: ShapeElement = { ...createShape('stat-row', 50, 600), stats: [] };
    const out = carryPageContent([untouched, edited], [slot, second]) as ShapeElement[];
    expect(out[0]).toMatchObject({ stats, x: 50, y: 400, width: 640 });
    expect(out[1]!.stats).toEqual([]);
  });

  it('carries rich text with the words, and drops the slot own runs', () => {
    const richText = [{ text: 'Strong words', bold: true }];
    const prev = [text(0, 'Strong words', { richText })];
    const placed = [text(0, 'slot', { richText: [{ text: 'slot' }] })];
    expect((carryPageContent(prev, placed)[0] as TextElement).richText).toEqual(richText);
    const plain = carryPageContent([text(0, 'Plain')], placed)[0] as TextElement;
    expect(plain.richText).toBeUndefined();
  });

  it('shrinks long words to fit their place, never growing and never below 40%', () => {
    const slot = text(0, 'Short', { textSize: 'lg', textScale: 2, width: 400, height: 80 });
    const short = carryPageContent([text(0, 'Hi', { textSize: 'lg', textScale: 3 })], [slot]);
    expect((short[0] as TextElement).textScale).toBe(2);
    const long = 'A much longer headline than this place was ever built for';
    const fitted = carryPageContent([text(0, long, { textSize: 'lg', textScale: 3 })], [slot]);
    const scale = (fitted[0] as TextElement).textScale!;
    expect(scale).toBeLessThan(2);
    expect(scale).toBeGreaterThanOrEqual(0.8);
    const huge = carryPageContent([text(0, long.repeat(20), { textSize: 'lg' })], [slot]);
    expect((huge[0] as TextElement).textScale).toBeCloseTo(0.8, 1);
  });

  it('carries into logo layouts too', () => {
    const page = relabel(build('title'), 'Your big headline', 'Q3 Results');
    const logo = carryPageContent(page, pageLayoutById('logo-icon-above').build(TALL));
    expect(labels(logo)).toContain('Q3 Results');
  });

  it('stays within budget: placeholders warm in under 400 ms, a carry in under 20 ms', () => {
    const t0 = performance.now();
    warmLayoutPlaceholders();
    expect(performance.now() - t0).toBeLessThan(400);
    const big = Array.from({ length: 300 }, (_, i) => text(i * 3, `Line ${i} words`));
    const t1 = performance.now();
    carryPageContent(big, build('agenda'));
    expect(performance.now() - t1).toBeLessThan(20);
  });

  it('ignores arrows on the old page', () => {
    const a = text(0, 'Mine');
    const b = text(100, 'Yours');
    const arrow = createPinnedArrow(a.id, 's', b.id, 'n');
    const placed = [text(0, 'slot')];
    expect(labels(carryPageContent([arrow, a, b], placed))).toEqual(['Mine']);
  });
});
