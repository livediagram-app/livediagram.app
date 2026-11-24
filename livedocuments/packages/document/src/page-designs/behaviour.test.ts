import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '../index';
import { layOutPages, pagesOf, type Page } from '../page';
import { pageDesignIdOf, pageDesignSet, withTabPageDesign } from './edits';
import { calmShareAt, designGuard, SCRIM_PAD } from './guard';
import { designPalette } from './palette';
import { pickPageDesign } from './pick';
import {
  calmMaskCss,
  clearPageDesignCache,
  hashKey,
  paintPageDesign,
  pageDesignCacheSize,
  pageDesignSvg,
  DESIGN_CACHE_MAX,
} from './render';
import { RHYTHM_QUIET_CALM, RHYTHM_QUIET_INTENSITY, resolvePageDesigns } from './resolve';
import {
  designSetBackground,
  designSetLayout,
  PAGE_DESIGN_SET_BY_ID,
  PAGE_DESIGN_SETS,
} from './sets';
import { resolveTuning } from './tuning';

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...extra,
});
const text = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'text',
    x,
    y,
    width: 400,
    height: 60,
    label: 'Hello',
    ...extra,
  }) as unknown as Element;
const tabOf = (pages: Page[], elements: Element[] = [], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements,
  pages,
  ...extra,
});
const light = designPalette({ elementStroke: '#2563eb' }, {}, false);

describe('resolvePageDesigns (blueprint "Resolution")', () => {
  it('gives each page its own design over the tab’s, and none to a page that opts out', () => {
    const pages = layOutPages([
      slide('a'),
      slide('b', { design: { id: 'grid' } }),
      slide('c', { design: { id: 'none' } }),
    ]);
    const out = resolvePageDesigns({ id: 'aurora' }, pages);
    expect(out.get('a')).toMatchObject({ design: { id: 'aurora' }, fromTab: true, role: 'title' });
    expect(out.get('b')).toMatchObject({ design: { id: 'grid' }, fromTab: false });
    expect(out.has('c')).toBe(false);
    expect(resolvePageDesigns(undefined, layOutPages([slide('a')])).size).toBe(0);
  });

  it('quietens content pages under the rhythm, not title or section pages', () => {
    const pages = layOutPages([slide('a'), slide('b'), slide('c')]);
    const r = pages[1]!.rect;
    const s = pages[2]!.rect;
    const elements = [
      text('t1', r.x + 10, r.y + 10),
      text('t2', s.x + 10, s.y + 10),
      {
        id: 'b',
        type: 'shape',
        shape: 'square',
        x: s.x + 50,
        y: s.y + 200,
        width: 40,
        height: 40,
      } as Element,
    ];
    const out = resolvePageDesigns({ id: 'aurora', rhythm: true }, pages, elements);
    const base = resolveTuning({ id: 'aurora' });
    expect(out.get('a')!.tuning.intensity).toBe(base.intensity);
    expect(out.get('b')!.role).toBe('section');
    expect(out.get('b')!.tuning.intensity).toBe(base.intensity);
    expect(out.get('c')!.role).toBe('content');
    expect(out.get('c')!.tuning.intensity).toBeCloseTo(base.intensity * RHYTHM_QUIET_INTENSITY);
    expect(out.get('c')!.tuning.calm).toBeGreaterThanOrEqual(RHYTHM_QUIET_CALM);
  });

  it('lays a flowing design across runs of pages wearing the tab design', () => {
    const pages = layOutPages([
      slide('a'),
      slide('b'),
      slide('c', { design: { id: 'grid' } }),
      slide('d'),
    ]);
    const out = resolvePageDesigns({ id: 'waves', flow: true }, pages);
    const w = pages[0]!.rect.width;
    expect(out.get('a')!.strip).toEqual({ x: 0, span: w * 2 });
    expect(out.get('b')!.strip).toEqual({ x: w, span: w * 2 });
    expect(out.get('c')!.strip).toBeUndefined();
    expect(out.get('d')!.strip).toBeUndefined();
  });
});

describe('paintPageDesign and the still frame (blueprint "Drawing", "Still frame")', () => {
  it('draws the same page once and keeps the cache bounded', () => {
    clearPageDesignCache();
    const a = paintPageDesign({ design: { id: 'grid' }, palette: light, width: 960, height: 540 });
    const b = paintPageDesign({
      design: { id: 'grid', intensity: 0.3 },
      palette: light,
      width: 960,
      height: 540,
    });
    expect(b.layers).toBe(a.layers);
    expect(b.intensity).toBe(0.3);
    for (let i = 0; i < DESIGN_CACHE_MAX + 20; i += 1)
      paintPageDesign({
        design: { id: 'dots', seed: i + 1 },
        palette: light,
        width: 100,
        height: 100,
      });
    expect(pageDesignCacheSize()).toBe(DESIGN_CACHE_MAX);
  });

  it('only animates an animatable design that asks to', () => {
    expect(
      paintPageDesign({
        design: { id: 'aurora', animate: true },
        palette: light,
        width: 10,
        height: 10,
      }).animate,
    ).toBe(true);
    expect(
      paintPageDesign({ design: { id: 'aurora' }, palette: light, width: 10, height: 10 }).animate,
    ).toBe(false);
  });

  it('frames the still design: clipped, masked by its calm, with grain and scrims, ids prefixed', () => {
    const d = paintPageDesign({
      design: { id: 'aurora', grain: 0.4, calm: 0.6 },
      palette: light,
      width: 960,
      height: 540,
    });
    const svg = pageDesignSvg(
      d,
      { x: 10, y: 20 },
      [{ x: 1, y: 2, width: 3, height: 4, fill: '#fff', opacity: 0.8 }],
      'p1-',
    );
    expect(svg).toContain('translate(10 20)');
    expect(svg).toContain(`mask="url(#p1-${d.uid}-calm)"`);
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('rx="12"');
    expect(svg).not.toMatch(new RegExp(`"#?${d.uid}`));
    const none = pageDesignSvg(
      paintPageDesign({ design: { id: 'grid', calm: 0 }, palette: light, width: 9, height: 9 }),
      { x: 0, y: 0 },
    );
    expect(none).not.toContain('mask=');
  });

  it('writes the calm as a CSS mask, none when there is no calm, and hashes keys stably', () => {
    expect(calmMaskCss(0)).toBeUndefined();
    expect(calmMaskCss(0.5)).toMatch(/^radial-gradient\(closest-side ellipse/);
    expect(hashKey('a')).toBe(hashKey('a'));
    expect(hashKey('a')).not.toBe(hashKey('b'));
  });
});

describe('designPalette (spec "Theme-driven colour")', () => {
  it('follows the theme, lifts colours on a dark page and inks for the page', () => {
    const d = designPalette({ elementStroke: '#2563eb' }, {}, true);
    expect(d.dark).toBe(true);
    expect(d.ink).toBe('#ffffff');
    expect(d.a).not.toBe('#2563eb');
    expect(light.a).toBe('#2563eb');
    expect(light.base).toBe('#ffffff');
    const own = designPalette(
      {},
      { background: { fill: { kind: 'solid', color: '#000000' } } },
      false,
      ['#ff0000', '#00ff00', '#0000ff'],
    );
    expect(own).toMatchObject({ dark: true, base: '#000000' });
  });
});

describe('designGuard (spec "Readability")', () => {
  const rect = { x: 0, y: 0, width: 960, height: 540 };
  const busy = paintPageDesign({
    design: { id: 'split-fields', intensity: 1, calm: 0 },
    palette: light,
    width: 960,
    height: 540,
  });
  const g = busy;

  it('puts a scrim behind a text that would not read, none in warn mode', () => {
    const out = designGuard(g, rect, [text('t', 100, 100, { textColor: '#93c5fd' })]);
    expect(out.failing).toEqual(['t']);
    expect(out.scrims[0]).toMatchObject({
      x: 100 - SCRIM_PAD,
      width: 400 + SCRIM_PAD * 2,
      fill: '#ffffff',
    });
    const warn = designGuard({ ...g, tuning: { ...g.tuning, guard: 'warn' } }, rect, [
      text('t', 100, 100, { textColor: '#93c5fd' }),
    ]);
    expect(warn).toEqual({ failing: ['t'], scrims: [] });
  });

  it('passes readable, filled, empty and off-page texts', () => {
    const out = designGuard(g, rect, [
      text('ok', 100, 100, { textColor: '#0f172a' }),
      text('filled', 100, 100, { textColor: '#93c5fd', fillColor: '#ffffff' }),
      text('empty', 100, 100, { label: ' ' }),
      text('off', 2000, 100),
      { id: 's', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as unknown as Element,
    ]);
    expect(out.failing).toEqual([]);
  });

  it('reads the calm as the mask draws it', () => {
    expect(calmShareAt(0, 0.5, 0.5)).toBe(1);
    expect(calmShareAt(1, 0.5, 0.5)).toBeCloseTo(0.08);
    expect(calmShareAt(1, 0, 0)).toBe(1);
  });
});

describe('design edits (blueprint "Data and persistence")', () => {
  it('sets and clears the tab design, the same tab when nothing changes', () => {
    const tab = tabOf([slide('a')]);
    const set = withTabPageDesign(tab, { id: 'grid', variant: 'lines' });
    expect(set.pageDesign).toEqual({ id: 'grid' });
    expect(withTabPageDesign(set, { id: 'grid' })).toBe(set);
    expect(withTabPageDesign(set, null).pageDesign).toBeUndefined();
    expect(withTabPageDesign(tab, null)).toBe(tab);
  });

  it('sets, opts out of and clears a page’s own design; refuses a locked or unknown page', () => {
    const tab = tabOf([slide('a'), slide('b', { locked: true })]);
    const own = pageDesignSet(tab, 'a', { id: 'waves' });
    if (!('tab' in own)) throw new Error('refused');
    expect(pagesOf(own.tab)[0]!.design).toEqual({ id: 'waves' });
    const none = pageDesignSet(own.tab, 'a', 'none');
    if (!('tab' in none)) throw new Error('refused');
    expect(pagesOf(none.tab)[0]!.design).toEqual({ id: 'none' });
    expect(pageDesignIdOf(pagesOf(none.tab)[0]!, { id: 'grid' })).toBeNull();
    const back = pageDesignSet(none.tab, 'a', null);
    if (!('tab' in back)) throw new Error('refused');
    expect(pagesOf(back.tab)[0]!.design).toBeUndefined();
    expect(pageDesignIdOf(pagesOf(back.tab)[0]!, { id: 'grid' })).toBe('grid');
    expect(pageDesignSet(back.tab, 'a', null)).toEqual({ tab: back.tab });
    expect(pageDesignSet(tab, 'b', { id: 'waves' })).toEqual({ refused: 'locked' });
    expect(pageDesignSet(tab, 'z', { id: 'waves' })).toEqual({ refused: 'unknown_page' });
  });
});

describe('design sets and picking (spec "Design sets")', () => {
  it('holds six or more sets, each a design, a background and layouts', () => {
    expect(PAGE_DESIGN_SETS.length).toBeGreaterThanOrEqual(6);
    const set = PAGE_DESIGN_SET_BY_ID['keynote-dark']!;
    expect(designSetBackground(set, { elementStroke: '#2563eb' })?.fill?.kind).toBe('gradient');
    expect(designSetBackground(PAGE_DESIGN_SET_BY_ID.editorial!, {})).toBeUndefined();
    expect(designSetLayout(set, 'slide', 0)).toBe('slide-title');
    expect(designSetLayout(set, 'slide', 1)).toBe('slide-bullets');
    expect(designSetLayout(set, 'slide', 3)).toBe('slide-bullets');
    expect(designSetLayout(set, 'infographic', 2)).toBe('facts-grid');
  });

  it('picks a design for words, falling back to Soft Mesh', () => {
    expect(pickPageDesign('Our quarterly startup pitch')).toBe('soft-mesh');
    expect(pickPageDesign('A retro arcade night')).toBe('scanlines');
    expect(pickPageDesign('')).toBe('soft-mesh');
  });
});
