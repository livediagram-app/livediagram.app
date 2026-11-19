import { describe, expect, it } from 'vitest';
import { newPageBackgroundOf, withNewPageBackground } from './tab-new-page-background';
import { pagesGivenNewPageBackground } from './pages-background-copy';
import { pageAdded, pageAddedLike } from './pages-edits';
import { withPageKindChosen } from './page-units';
import { pagesOf, type Page } from './page';
import type { Tab } from './index';

// docs/specs/007-editor/pages-mode.md "A new page's background" and docs/specs/011-theme/canvas-and-theme-dialog.md
// "New Page Background": a tab's own background for the pages made on it.

const mint = { kind: 'solid' as const, color: '#ccfbf1' };
const steel = { kind: 'gradient' as const, from: '#f1f5f9', to: '#cbd5e1', angle: 160 };
const picture = { kind: 'image' as const, imageId: 'img-1' };

const wireframe = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  ...extra,
});
const tabOf = (pages: Page[], extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'Design',
  elements: [],
  pages,
  ...extra,
});
const backgrounds = (tab: Tab) => Object.fromEntries(pagesOf(tab).map((p) => [p.id, p.background]));

describe('newPageBackgroundOf', () => {
  it('reads none, the chosen paper, and a fill with its pattern, dropping a picture and junk', () => {
    expect(newPageBackgroundOf({})).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: 3 })).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: [] })).toBeUndefined();
    expect(newPageBackgroundOf({ newPageBackground: {} })).toEqual({});
    expect(newPageBackgroundOf({ newPageBackground: { fill: mint, pattern: 'dots' } })).toEqual({
      fill: mint,
      pattern: 'dots',
    });
    expect(newPageBackgroundOf({ newPageBackground: { fill: picture } })).toEqual({});
  });
});

describe('withNewPageBackground', () => {
  it('patches a part, keeps the paper when both go, clears with null, the same tab for no change', () => {
    const tab = tabOf([]);
    const filled = withNewPageBackground(tab, { fill: mint });
    expect(filled.newPageBackground).toEqual({ fill: mint });
    expect(withNewPageBackground(filled, { fill: mint })).toBe(filled);
    const paper = withNewPageBackground(filled, { fill: undefined });
    expect(paper.newPageBackground).toEqual({});
    const carried = withNewPageBackground(paper, null);
    expect('newPageBackground' in carried).toBe(false);
    expect(withNewPageBackground(carried, null)).toBe(carried);
  });
});

describe('a new page', () => {
  const own = { newPageBackground: { fill: mint, pattern: 'dots' as const } };

  it('starts on the tab’s own background, a logo page on its fill alone, the paper when that is chosen', () => {
    const design = tabOf([wireframe('a', { background: { fill: steel } })], own);
    const added = pageAdded(design, 'wireframe', 'b');
    if (!('tab' in added)) throw new Error('refused');
    expect(backgrounds(added.tab).b).toEqual({ fill: mint, pattern: 'dots' });
    const like = pageAddedLike(design, 'a', 'c');
    if (!('tab' in like)) throw new Error('refused');
    expect(backgrounds(like.tab).c).toEqual({ fill: mint, pattern: 'dots' });
    const logos = tabOf([{ id: 'l', orientation: 'portrait', kind: 'logo', size: 'logo' }], own);
    const logo = pageAdded(logos, 'logo', 'm');
    if (!('tab' in logo)) throw new Error('refused');
    expect(backgrounds(logo.tab).m).toEqual({ fill: mint });
    const paper = pageAdded({ ...design, newPageBackground: {} }, 'wireframe', 'b');
    if (!('tab' in paper)) throw new Error('refused');
    expect(backgrounds(paper.tab).b).toBeUndefined();
  });

  it('as the first page’s kind is chosen, unless it has a background of its own', () => {
    const first = tabOf([{ id: 'p', orientation: 'portrait' }], own);
    expect(backgrounds(withPageKindChosen(first, 'p', 'wireframe')!).p).toEqual({
      fill: mint,
      pattern: 'dots',
    });
    const painted = tabOf([{ id: 'p', orientation: 'portrait', background: { fill: steel } }], own);
    expect(backgrounds(withPageKindChosen(painted, 'p', 'logo')!).p).toEqual({ fill: steel });
    const paper = tabOf([{ id: 'p', orientation: 'portrait' }], { newPageBackground: {} });
    expect(backgrounds(withPageKindChosen(paper, 'p', 'wireframe')!).p).toBeUndefined();
  });
});

describe('pagesGivenNewPageBackground', () => {
  it('gives every page the background, a logo page its fill, passes a photo page, keeps a locked one', () => {
    const tab = tabOf(
      [
        wireframe('a'),
        wireframe('b', { background: { fill: steel } }),
        wireframe('c', { locked: true }),
        {
          id: 'l',
          orientation: 'portrait',
          kind: 'logo',
          size: 'logo',
          background: { fill: steel },
        },
      ],
      { newPageBackground: { fill: mint, pattern: 'grid' } },
    );
    const out = pagesGivenNewPageBackground(tab);
    expect(backgrounds(out.tab)).toEqual({
      a: { fill: mint, pattern: 'grid' },
      b: { fill: mint, pattern: 'grid' },
      c: undefined,
      l: { fill: mint },
    });
    expect(out.applied).toBe(3);
    expect(out.skipped).toBe(1);
  });

  it('passes photo pages by, and puts pages back on the paper with no background of the tab’s own', () => {
    const photo = { id: 'ph', orientation: 'landscape', kind: 'photo' } as Page;
    const out = pagesGivenNewPageBackground(tabOf([photo]));
    expect(out.applied).toBe(0);
    expect(out.memory).toBeUndefined();
    const bare = pagesGivenNewPageBackground(
      tabOf([wireframe('a', { background: { fill: steel } })]),
    );
    expect(backgrounds(bare.tab).a).toBeUndefined();
  });
});
