import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { PAGE_LAYOUTS } from '@livediagram/templates';

// docs/specs/007-editor/illustrate-pages.md "Layouts": the Posters category's layouts.
const POSTER_IDS = [
  'poster',
  'gig-poster',
  'research-poster',
  'coming-soon',
  'exhibition',
  'travel-poster',
  'workshop',
  'hiring',
  'big-sale',
  'notice',
  'motivational',
] as const;

const TALL = { x: 0, y: 0, width: 680, height: 960 };
const WIDE = { x: 0, y: 0, width: 960, height: 680 };
const SQUARE = { x: 0, y: 0, width: 930, height: 930 };

const build = (id: string, box: typeof TALL) => PAGE_LAYOUTS.find((l) => l.id === id)!.build(box);
const kinds = (els: Element[]) => els.map((e) => (e.type === 'shape' ? e.shape : e.type)).sort();
const labels = (els: Element[]) =>
  els.flatMap((e) => ('label' in e && typeof e.label === 'string' ? [e.label] : []));

describe('posters layouts', () => {
  it('are the eleven Posters layouts, in the picker order', () => {
    const ids = PAGE_LAYOUTS.filter((l) => l.category === 'posters').map((l) => l.id);
    expect([...ids].sort()).toEqual([...POSTER_IDS].sort());
    for (const l of PAGE_LAYOUTS.filter((p) => p.category === 'posters')) {
      expect(l.label).toMatch(/^[A-Z]/);
      expect(l.description.includes(String.fromCharCode(0x2014))).toBe(false);
    }
  });

  it('carry no colours of their own', () => {
    for (const id of POSTER_IDS) {
      for (const box of [TALL, WIDE, SQUARE]) {
        for (const el of build(id, box)) {
          expect('fillColor' in el ? el.fillColor : undefined).toBeUndefined();
          expect('textColor' in el ? el.textColor : undefined).toBeUndefined();
        }
      }
    }
  });

  it('set a wide page side by side and stack a tall one', () => {
    // The gig poster's photo runs the full height beside the words when wide, and across the
    // page between them when tall.
    const photo = (els: Element[]) => els.find((e) => e.type === 'image')!;
    expect(photo(build('gig-poster', WIDE)).height).toBe(WIDE.height);
    expect(photo(build('gig-poster', TALL)).width).toBe(TALL.width);
  });

  it('lay the research poster in three columns when wide, two when tall', () => {
    const xs = (els: Element[]) =>
      new Set(
        els.flatMap((e) =>
          e.type === 'shape' && e.shape === 'square' && e.textBold && e.label ? [e.x] : [],
        ),
      );
    expect(xs(build('research-poster', WIDE)).size).toBe(3);
    expect(xs(build('research-poster', TALL)).size).toBe(2);
    // Its numbers cite their source.
    expect(labels(build('research-poster', TALL)).some((l) => l.startsWith('Source:'))).toBe(true);
    expect(kinds(build('research-poster', TALL))).toContain('bar-chart');
  });

  it('give the workshop a tear-off strip of turned tabs', () => {
    const els = build('workshop', TALL);
    const tabs = els.filter((e) => e.type === 'text' && e.rotation === -90);
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    const dashed = els.filter((e) => e.type === 'shape' && e.strokeStyle === 'dashed');
    expect(dashed.length).toBe(tabs.length);
  });

  it('set each headline line of a multi-line title at one size', () => {
    const scales = (id: string, words: string[]) =>
      new Set(
        build(id, TALL)
          .filter((e) => e.type === 'text' && words.includes(e.label ?? ''))
          .map((e) => (e.type === 'text' ? e.textScale : 0)),
      );
    expect(scales('notice', ['Hard hats must be worn', 'beyond this point']).size).toBe(1);
    expect(scales('research-poster', ['Street trees cool', 'summer streets by 4°C']).size).toBe(1);
  });

  it('end every call-to-action poster in its offer', () => {
    for (const id of ['gig-poster', 'hiring', 'big-sale']) {
      expect(kinds(build(id, TALL))).toContain('banner');
      expect(kinds(build(id, WIDE))).toContain('banner');
    }
  });
});
