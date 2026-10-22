import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livepages/vitest-config/cpu-time';
import {
  backgroundPatchFor,
  pageBackgroundCopied,
  pageBackgroundSpread,
} from './pages-background-copy';
import { pagesOf, layOutPages, type Page } from './page';
import { pageBackgroundSet } from './pages-edits';
import type { Element, Tab } from './index';

// docs/specs/007-editor/pages-mode.md "Copying a background": a page's format is its
// background, given to every other page of its kind (Apply to All) or to one page (the format
// painter).

const dusk = { kind: 'gradient' as const, from: '#1e1b4b', to: '#4c1d95', angle: 160 };
const animated = { ...dusk, motion: 'aurora' as const, speed: 1.5 };
const picture = { kind: 'image' as const, imageId: 'img-1' };

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  ...extra,
});

const tabOf = (pages: Page[], elements: Element[] = []): Tab => ({
  id: 't',
  name: 'Deck',
  elements,
  pages,
});

const backgrounds = (tab: Tab) => Object.fromEntries(pagesOf(tab).map((p) => [p.id, p.background]));

describe('pageBackgroundSpread', () => {
  it('gives every other slide the background, animated speed and pattern included', () => {
    const tab = tabOf([
      slide('a', { background: { fill: animated, pattern: 'dots' } }),
      slide('b'),
      slide('c', { background: { fill: { kind: 'solid', color: '#ffffff' } } }),
    ]);
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    expect(out).toMatchObject({ applied: 2, skipped: 0 });
    const bg = { fill: animated, pattern: 'dots' };
    expect(backgrounds(out.tab)).toEqual({ a: bg, b: bg, c: bg });
  });

  it('reaches only pages of the same kind', () => {
    const tab = tabOf([
      slide('a', { background: { fill: dusk } }),
      { id: 'i', orientation: 'portrait' },
      slide('b'),
    ]);
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab)).toEqual({ a: { fill: dusk }, i: undefined, b: { fill: dusk } });
    expect(out.applied).toBe(1);
  });

  it('spreads the plain paper too, clearing what the others wore', () => {
    const tab = tabOf([slide('a'), slide('b', { background: { fill: dusk, pattern: 'grid' } })]);
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab).b).toBeUndefined();
  });

  it('leaves a locked slide as it is and counts it', () => {
    const tab = tabOf([
      slide('a', { background: { fill: dusk } }),
      slide('b', { locked: true }),
      slide('c'),
    ]);
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    expect(out).toMatchObject({ applied: 1, skipped: 1 });
    expect(backgrounds(out.tab).b).toBeUndefined();
  });

  it('counts a slide already wearing it as applied, with no change', () => {
    const tab = tabOf([
      slide('a', { background: { fill: dusk } }),
      slide('b', { background: { fill: dusk } }),
    ]);
    const out = pageBackgroundSpread(tab, 'a');
    expect(out).toMatchObject({ tab, applied: 1, skipped: 0 });
  });

  it('re-inks what sits on each page it reaches, as painting each in turn does', () => {
    const [, b, c] = layOutPages([slide('a'), slide('b'), slide('c')]);
    const pale = (id: string, at: { x: number; y: number }) =>
      ({
        id,
        type: 'shape',
        shape: 'square',
        label: 'Plain label',
        x: at.x + 100,
        y: at.y + 100,
        width: 200,
        height: 80,
        fillColor: '#f0f9ff',
        strokeColor: '#bae6fd',
      }) as Element;
    const night = { fill: { kind: 'solid' as const, color: '#0f172a' } };
    const tab = tabOf(
      [slide('a', { background: night }), slide('b'), slide('c')],
      [pale('on-b', b!.rect), pale('on-c', c!.rect)],
    );
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    const one = pageBackgroundSet(tab, 'b', night);
    if (!('tab' in one)) throw new Error('refused');
    const two = pageBackgroundSet(one.tab, 'c', night, one.memory);
    if (!('tab' in two)) throw new Error('refused');
    expect(out.tab.elements).toEqual(two.tab.elements);
    expect(out.tab.elements).not.toEqual(tab.elements);
  });

  it('is refused with no other page of the kind, or an unknown page', () => {
    expect(
      pageBackgroundSpread(tabOf([slide('a'), { id: 'i', orientation: 'portrait' }]), 'a'),
    ).toEqual({
      refused: 'no_other_pages',
    });
    expect(pageBackgroundSpread(tabOf([slide('a')]), 'zz')).toEqual({ refused: 'unknown_page' });
  });

  it('copies a logo page’s fill to other logo pages, never a pattern', () => {
    const logo = (id: string, extra: Partial<Page> = {}): Page => ({
      id,
      orientation: 'portrait',
      kind: 'logo',
      size: 'logo',
      ...extra,
    });
    const tab = tabOf([logo('a', { background: { fill: dusk } }), logo('b')]);
    const out = pageBackgroundSpread(tab, 'a');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab).b).toEqual({ fill: dusk });
  });
});

describe('pageBackgroundCopied', () => {
  it('paints one page with another’s background', () => {
    const tab = tabOf([
      slide('a', { background: { fill: picture, pattern: 'lines' } }),
      slide('b'),
    ]);
    const out = pageBackgroundCopied(tab, 'a', 'b');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab).b).toEqual({ fill: picture, pattern: 'lines' });
  });

  it('paints across kinds, a slide onto an infographic page', () => {
    const tab = tabOf([
      slide('a', { background: { fill: dusk } }),
      { id: 'i', orientation: 'portrait' },
    ]);
    const out = pageBackgroundCopied(tab, 'a', 'i');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab).i).toEqual({ fill: dusk });
  });

  it('is no edit onto the source itself', () => {
    const tab = tabOf([slide('a', { background: { fill: dusk } }), slide('b')]);
    expect(pageBackgroundCopied(tab, 'a', 'a')).toEqual({ tab });
  });

  it('refuses a locked page and a picture onto a logo page', () => {
    const tab = tabOf([
      slide('a', { background: { fill: picture } }),
      slide('b', { locked: true }),
      { id: 'l', orientation: 'portrait', kind: 'logo', size: 'logo' },
    ]);
    expect(pageBackgroundCopied(tab, 'a', 'b')).toEqual({ refused: 'locked' });
    expect(pageBackgroundCopied(tab, 'a', 'l')).toEqual({ refused: 'picture_not_offered' });
    expect(pageBackgroundCopied(tab, 'a', 'zz')).toEqual({ refused: 'unknown_page' });
  });
});

describe('backgroundPatchFor', () => {
  it('carries the fill and the pattern, absent ones clearing the target’s', () => {
    expect(backgroundPatchFor({ kind: 'slide' }, undefined)).toEqual({
      fill: undefined,
      pattern: undefined,
    });
  });

  it('leaves a logo page’s pattern out', () => {
    expect(backgroundPatchFor({ kind: 'logo' }, { fill: dusk, pattern: 'dots' })).toEqual({
      fill: dusk,
    });
  });
});

// Performance: a deck at the page cap, every page full, takes one press. Measured 130 ms CPU on an
// M-series Mac, 175 ms under coverage: the pages are re-inked in one walk (pagesInkFor), where
// page by page cost 251 ms and 706 ms, and went over this budget on a loaded CI runner. The budget is
// loose for slower runners, there to catch a slide back into re-reading the tab for every page.
describe('pageBackgroundSpread at the page cap', () => {
  it('gives 99 full slides one background within its budget', () => {
    const pages = Array.from({ length: 100 }, (_, i) =>
      slide(`p${i}`, i === 0 ? { background: { fill: { kind: 'solid', color: '#0f172a' } } } : {}),
    );
    const laid = layOutPages(pages);
    const elements = laid.flatMap((pg) =>
      Array.from({ length: 50 }, (_, j): Element => ({
        id: `${pg.id}-e${j}`,
        type: 'shape',
        shape: 'square',
        label: 'x',
        x: pg.rect.x + 20 + (j % 10) * 100,
        y: pg.rect.y + 20 + Math.floor(j / 10) * 100,
        width: 80,
        height: 60,
        fillColor: '#f0f9ff',
        strokeColor: '#bae6fd',
      })),
    );
    const tab = tabOf(pages, elements);
    let out: ReturnType<typeof pageBackgroundSpread<Tab>> | undefined;
    const ms = cpuMsOf(() => {
      out = pageBackgroundSpread(tab, 'p0');
    });
    expect(out).toMatchObject({ applied: 99 });
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });
});
