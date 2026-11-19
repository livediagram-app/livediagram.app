import { describe, expect, it } from 'vitest';
import { newPageBackgroundOf, withNewPageBackground } from './tab-new-page-background';
import { pagesGivenNewPageBackground, withLookPageBackground } from './pages-background-copy';
import { withDefaultPageBackgrounds } from './page-default-background';
import { pageAdded } from './pages-edits';
import { themeBackgroundPresets, withPageBackgroundsFollowingTheme } from './page-theme-fills';
import { pagesOf, type Page } from './page';
import type { Tab, ThemeDefinition } from './index';

// docs/specs/007-editor/pages-mode.md "A new page's background" and docs/specs/011-theme/canvas-and-theme-dialog.md
// "New Page Background": a tab's own background for the pages made on it.

const mint = { kind: 'solid' as const, color: '#ccfbf1' };
const steel = { kind: 'gradient' as const, from: '#f1f5f9', to: '#cbd5e1', angle: 160 };
const picture = { kind: 'image' as const, imageId: 'img-1' };

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  ...extra,
});
const tabOf = (pages: Page[], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'Deck',
  elements: [],
  pages,
  ...extra,
});
const backgrounds = (tab: Tab) => Object.fromEntries(pagesOf(tab).map((p) => [p.id, p.background]));

const theme = (stroke: string): ThemeDefinition =>
  ({ elementStroke: stroke }) as unknown as ThemeDefinition;

describe('newPageBackgroundOf', () => {
  it('reads none, the chosen paper, and a fill with its pattern, dropping a picture and junk', () => {
    expect(newPageBackgroundOf({})).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: 'nope' })).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: [] })).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: {} })).toEqual({});
    expect(newPageBackgroundOf({ newPageBackground: { fill: mint, pattern: 'dots' } })).toEqual({
      fill: mint,
      pattern: 'dots',
    });
    expect(newPageBackgroundOf({ newPageBackground: { fill: picture, pattern: 'grid' } })).toEqual({
      pattern: 'grid',
    });
  });
});

describe('withNewPageBackground', () => {
  it('patches a part, keeps the paper when both go, clears with null, and hands back the same tab for no change', () => {
    const tab = tabOf([]);
    const filled = withNewPageBackground(tab, { fill: mint });
    expect(filled.newPageBackground).toEqual({ fill: mint });
    const patterned = withNewPageBackground(filled, { pattern: 'lines' });
    expect(patterned.newPageBackground).toEqual({ fill: mint, pattern: 'lines' });
    expect(withNewPageBackground(patterned, { pattern: 'lines' })).toBe(patterned);
    const paper = withNewPageBackground(patterned, { fill: undefined, pattern: undefined });
    expect(paper.newPageBackground).toEqual({});
    const carried = withNewPageBackground(paper, null);
    expect('newPageBackground' in carried).toBe(false);
    expect(withNewPageBackground(carried, null)).toBe(carried);
  });
});

describe('a new page', () => {
  it('starts on the tab’s own background rather than the page before’s, and on the paper when that is chosen', () => {
    const deck = tabOf([slide('a', { background: { fill: steel } })], {
      newPageBackground: { fill: mint, pattern: 'dots' },
    });
    const out = pageAdded(deck, 'slide', 'b', 'f');
    if (!('tab' in out)) throw new Error('refused');
    expect(backgrounds(out.tab).b).toEqual({ fill: mint, pattern: 'dots' });
    const paper = pageAdded({ ...deck, newPageBackground: {} }, 'slide', 'b', 'f');
    if (!('tab' in paper)) throw new Error('refused');
    expect(backgrounds(paper.tab).b).toBeUndefined();
    // Without one, it carries over the page before as ever.
    const carried = pageAdded(tabOf(deck.pages!), 'slide', 'b', 'f');
    if (!('tab' in carried)) throw new Error('refused');
    expect(backgrounds(carried.tab).b).toEqual({ fill: steel });
  });

  it('of any kind takes it as its first page is made, an article included, and the chosen paper leaves it bare', () => {
    const article: Page = { id: 'a', orientation: 'portrait', kind: 'article', flow: 'a' };
    const own = withDefaultPageBackgrounds(
      tabOf([article], { newPageBackground: { fill: mint } }),
      theme('#7c3aed'),
      new Set(['a']),
    );
    expect(backgrounds(own).a).toEqual({ fill: mint });
    const paper = tabOf([slide('s')], { newPageBackground: {} });
    expect(withDefaultPageBackgrounds(paper, theme('#7c3aed'), new Set(['s']))).toBe(paper);
  });
});

describe('pagesGivenNewPageBackground', () => {
  it('gives every page the background, an article its fill alone, and leaves a locked page, counted', () => {
    const tab = tabOf(
      [
        slide('a'),
        slide('b', { background: { fill: steel } }),
        slide('c', { locked: true }),
        {
          id: 'd',
          orientation: 'portrait',
          kind: 'article',
          flow: 'd',
          background: { pattern: 'lines' },
        },
      ],
      { newPageBackground: { fill: mint, pattern: 'grid' } },
    );
    const out = pagesGivenNewPageBackground(tab);
    expect(backgrounds(out.tab)).toEqual({
      a: { fill: mint, pattern: 'grid' },
      b: { fill: mint, pattern: 'grid' },
      c: undefined,
      d: { fill: mint, pattern: 'lines' },
    });
    expect(out.applied).toBe(3);
    expect(out.skipped).toBe(1);
  });

  it('puts every page back on the paper when the tab has none, and changes nothing on an empty tab', () => {
    const out = pagesGivenNewPageBackground(tabOf([slide('a', { background: { fill: steel } })]));
    expect(backgrounds(out.tab).a).toBeUndefined();
    const empty = tabOf([]);
    const none = pagesGivenNewPageBackground({ ...empty, pages: [slide('x', { locked: true })] });
    expect(none.applied).toBe(0);
    expect(none.memory).toBeUndefined();
  });
});

describe('withLookPageBackground', () => {
  const violet = theme('#7c3aed');
  const mist = themeBackgroundPresets(violet).find((p) => p.id === 'theme-mist')!.fill;

  it('sets the default and repaints the pages on the paper or the theme’s own fill, never a painted one', () => {
    const tab = tabOf([
      slide('paper'),
      slide('themed', { background: { fill: mist } }),
      slide('painted', { background: { fill: steel } }),
    ]);
    const out = withLookPageBackground(tab, { fill: mint }, violet);
    expect(out.tab.newPageBackground).toEqual({ fill: mint });
    expect(backgrounds(out.tab)).toEqual({
      paper: { fill: mint },
      themed: { fill: mint },
      painted: { fill: steel },
    });
  });

  it('with a default already set, repaints only the pages still on it', () => {
    const tab = tabOf([slide('old', { background: { fill: steel } }), slide('bare')], {
      newPageBackground: { fill: steel },
    });
    const out = withLookPageBackground(tab, { fill: mint, pattern: 'dots' }, violet);
    expect(backgrounds(out.tab)).toEqual({ old: { fill: mint, pattern: 'dots' }, bare: undefined });
  });
});

describe('a theme change', () => {
  it('carries a default on the old theme’s own fill to the new theme’s, and leaves any other', () => {
    const [violet, teal] = [theme('#7c3aed'), theme('#0d9488')];
    const mist = (t: ThemeDefinition) =>
      themeBackgroundPresets(t).find((p) => p.id === 'theme-mist')!.fill;
    const tab = tabOf([], { newPageBackground: { fill: mist(violet), pattern: 'dots' } });
    expect(withPageBackgroundsFollowingTheme(tab, violet, teal).newPageBackground).toEqual({
      fill: mist(teal),
      pattern: 'dots',
    });
    const own = tabOf([], { newPageBackground: { fill: mint } });
    expect(withPageBackgroundsFollowingTheme(own, violet, teal)).toBe(own);
    const bare = tabOf([], { newPageBackground: { pattern: 'dots' } });
    expect(withPageBackgroundsFollowingTheme(bare, violet, teal)).toBe(bare);
  });
});
