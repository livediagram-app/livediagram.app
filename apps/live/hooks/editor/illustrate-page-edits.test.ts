import { describe, expect, it, vi } from 'vitest';
import {
  illustratePagesOf,
  layOutIllustratePages,
  type Element,
  type Tab,
} from '@livediagram/document';
import { illustratePageEdits } from './illustrate-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Page actions": each edit is one tab commit.
const box = (id: string, cx: number) =>
  ({ id, type: 'shape', shape: 'square', x: cx - 10, y: -10, width: 20, height: 20 }) as Element;

function harness(tab: Tab) {
  let tabs = [tab];
  const onGoTo = vi.fn();
  const onLayoutPlaced = vi.fn();
  const toastInfo = vi.fn();
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    illustratePageEdits({
      tabId: tab.id,
      current: illustratePagesOf(tabs[0]!),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo,
      onLayoutPlaced,
      toastInfo,
    });
  return { edits, tab: () => tabs[0]!, commitTabs, onGoTo, onLayoutPlaced, toastInfo };
}

const twoPages = (): Tab =>
  ({
    id: 't',
    name: 'T',
    elements: [box('a', 0), box('b', 794 + 96)],
    pages: [
      { id: 'page-1', orientation: 'portrait' },
      { id: 'page-2', orientation: 'portrait' },
    ],
  }) as unknown as Tab;

describe('Illustrate page edits', () => {
  it('renames, trimming, and clears an empty name', () => {
    const h = harness(twoPages());
    h.edits().rename('page-1', '  Intro  ');
    expect(illustratePagesOf(h.tab())[0]!.name).toBe('Intro');
    h.edits().rename('page-1', '');
    expect(illustratePagesOf(h.tab())[0]!.name).toBeUndefined();
  });

  it('stores A4 as no size, and skips a no-op', () => {
    const h = harness(twoPages());
    h.edits().setSize('page-1', 'a4');
    expect(h.commitTabs).not.toHaveBeenCalled();
    h.edits().setSize('page-1', 'square');
    expect(illustratePagesOf(h.tab())[0]!.size).toBe('square');
    h.edits().setSize('page-1', 'a4');
    expect('size' in illustratePagesOf(h.tab())[0]!).toBe(false);
  });

  it('moves a page with its content', () => {
    const h = harness(twoPages());
    h.edits().movePage('page-1', 1);
    expect(illustratePagesOf(h.tab()).map((p) => p.id)).toEqual(['page-2', 'page-1']);
    const a = h.tab().elements.find((e) => e.id === 'a') as Element & { x: number };
    expect(a.x + 10).toBe(794 + 96);
  });

  // docs/specs/007-editor/illustrate-pages.md "Page actions": a delete never leaves nothing in view.
  it('goes to the page before a deleted one, or the next when the first goes', () => {
    const last = harness(twoPages());
    last.edits().removePage!('page-2');
    expect(last.onGoTo).toHaveBeenLastCalledWith('page-1');
    const first = harness(twoPages());
    first.edits().removePage!('page-1');
    expect(first.onGoTo).toHaveBeenLastCalledWith('page-2');
  });

  it('deletes a page with its content, and the next page closes the gap', () => {
    const h = harness(twoPages());
    h.edits().removePage!('page-1');
    expect(h.tab().elements.map((e) => e.id)).toEqual(['b']);
    const b = h.tab().elements[0] as Element & { x: number };
    expect(b.x + 10).toBe(0);
  });

  it('duplicates a page, announcing the copy', () => {
    const h = harness(twoPages());
    h.edits().duplicatePage!('page-1');
    const ids = illustratePagesOf(h.tab()).map((p) => p.id);
    expect(ids).toHaveLength(3);
    expect([ids[0], ids[2]]).toEqual(['page-1', 'page-2']);
    expect(h.tab().elements).toHaveLength(3);
    expect(h.onGoTo).toHaveBeenCalledWith(ids[1]);
  });

  it('paints and clears a background', () => {
    const h = harness(twoPages());
    h.edits().setBackground('page-2', {
      fill: { kind: 'solid', color: '#0f172a' },
      pattern: 'dots',
    });
    expect(illustratePagesOf(h.tab())[1]!.background?.pattern).toBe('dots');
    const commits = h.commitTabs.mock.calls.length;
    // The same again is no edit.
    h.edits().setBackground('page-2', { pattern: 'dots' });
    expect(h.commitTabs.mock.calls.length).toBe(commits);
    h.edits().setBackground('page-2', { fill: undefined, pattern: undefined });
    expect(illustratePagesOf(h.tab())[1]!.background).toBeUndefined();
  });

  it('replaces a page with a layout inside its margins, leaving other pages alone', () => {
    const h = harness(twoPages());
    expect(h.edits().contentCount('page-1')).toBe(1);
    h.edits().applyLayout('page-1', 'key-stats');
    const els = h.tab().elements;
    expect(els.some((e) => e.id === 'a')).toBe(false);
    expect(els.some((e) => e.id === 'b')).toBe(true);
    expect(h.edits().contentCount('page-1')).toBe(els.length - 1);
    expect(h.onLayoutPlaced).toHaveBeenCalled();
  });

  it('frames a turned or resized page again, as the view frames the page itself', () => {
    const h = harness(twoPages());
    h.edits().setOrientation('page-1', 'landscape');
    expect(h.onGoTo).toHaveBeenLastCalledWith('page-1');
    h.onGoTo.mockClear();
    h.edits().setSize('page-1', 'a3');
    expect(h.onGoTo).toHaveBeenLastCalledWith('page-1');
  });

  it('re-fits a full page into the page when it turns, text scaling with it', () => {
    const h = harness(twoPages());
    h.edits().applyLayout('page-1', 'top-tips');
    h.edits().setOrientation('page-1', 'landscape');
    const [page] = layOutIllustratePages(illustratePagesOf(h.tab()));
    const r = page!.rect;
    const onPage = h.tab().elements.filter((e) => e.id !== 'b' && e.type !== 'arrow');
    for (const e of onPage as (Element & {
      x: number;
      y: number;
      width: number;
      height: number;
    })[]) {
      expect(e.x).toBeGreaterThanOrEqual(r.x - 1);
      expect(e.y).toBeGreaterThanOrEqual(r.y - 1);
      expect(e.x + e.width).toBeLessThanOrEqual(r.x + r.width + 1);
      expect(e.y + e.height).toBeLessThanOrEqual(r.y + r.height + 1);
    }
    const title = onPage.find((e) => e.type === 'text') as { textScale?: number };
    expect(title.textScale).toBeLessThan(2);
  });
});

describe('Illustrate page edits: documents', () => {
  const withDocument = (): Tab =>
    ({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'page-1', orientation: 'portrait', size: 'square' },
        { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' },
        { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f' },
      ],
      articles: { f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Hi' }] }] } },
    }) as unknown as Tab;

  it('adds an infographic page like the last infographic, and a document on paper', () => {
    const h = harness(withDocument());
    h.edits().addPage!('infographic');
    expect(illustratePagesOf(h.tab()).at(-1)).toMatchObject({ size: 'square' });
    h.edits().addPage!('article');
    const added = illustratePagesOf(h.tab()).at(-1)!;
    expect(added.kind).toBe('article');
    expect(added.size).toBeUndefined();
    expect(Object.keys(h.tab().articles!)).toHaveLength(2);
  });

  it('turns, sizes and paints every page of a document together', () => {
    const h = harness(withDocument());
    h.edits().setOrientation('d2', 'landscape');
    h.edits().setSize('d1', 'letter');
    h.edits().setBackground('d1', { pattern: 'lines' });
    const [, a, b] = illustratePagesOf(h.tab());
    for (const p of [a!, b!]) {
      expect(p).toMatchObject({
        orientation: 'landscape',
        size: 'letter',
        background: { pattern: 'lines' },
      });
    }
  });

  it('moves, duplicates and deletes the whole document', () => {
    const h = harness(withDocument());
    expect(h.edits().canMove('d2', 1)).toBe(false);
    h.edits().movePage('d2', -1);
    expect(illustratePagesOf(h.tab()).map((p) => p.id)).toEqual(['d1', 'd2', 'page-1']);
    h.edits().duplicatePage!('d1');
    expect(illustratePagesOf(h.tab())).toHaveLength(5);
    expect(Object.keys(h.tab().articles!)).toHaveLength(2);
    h.edits().removePage!('d2');
    expect(illustratePagesOf(h.tab())).toHaveLength(3);
    expect(Object.keys(h.tab().articles!)).toHaveLength(1);
  });
});

// docs/specs/007-editor/illustrate-pages.md "Page kinds", "Sizes": a slide is added landscape in a
// slide size, keeps to the slide sizes and never turns.
describe('slide page edits', () => {
  const slideTab = (): Tab =>
    ({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'page-1', orientation: 'portrait', size: 'social', kind: 'infographic' },
        { id: 's1', orientation: 'landscape', size: 'slide-classic', kind: 'slide' },
      ],
    }) as unknown as Tab;

  it('adds a slide in the last slide size, and an infographic page modelled on the last infographic', async () => {
    const { track } = await import('@/lib/telemetry');
    const h = harness(slideTab());
    h.edits().addPage!('slide');
    expect(track).toHaveBeenLastCalledWith('Tab', 'Changed', 'SlidePageAdded');
    h.edits().addPage!('infographic');
    const [, , slide, page] = illustratePagesOf(h.tab());
    expect(slide).toMatchObject({ orientation: 'landscape', size: 'slide-classic', kind: 'slide' });
    expect(page).toMatchObject({ orientation: 'portrait', size: 'social' });
  });

  it('adds a 16:9 slide when there is no slide yet', () => {
    const h = harness(twoPages());
    h.edits().addPage!('slide');
    expect(illustratePagesOf(h.tab())[2]).toMatchObject({ size: 'slide', kind: 'slide' });
  });

  it('never turns a slide, nor gives it a size that is not a slide size', () => {
    const h = harness(slideTab());
    h.edits().setOrientation('s1', 'portrait');
    h.edits().setSize('s1', 'a4');
    expect(h.commitTabs).not.toHaveBeenCalled();
    h.edits().setSize('s1', 'slide');
    expect(illustratePagesOf(h.tab())[1]).toMatchObject({
      orientation: 'landscape',
      size: 'slide',
    });
  });

  it('never turns an infographic page in the slide size', () => {
    const h = harness(slideTab());
    h.edits().setSize('page-1', 'slide');
    h.commitTabs.mockClear();
    h.edits().setOrientation('page-1', 'landscape');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });

  it('chooses Slide for the only, empty page', async () => {
    const { track } = await import('@/lib/telemetry');
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'page-1', orientation: 'portrait' }],
    } as unknown as Tab);
    h.edits().choosePageKind('page-1', 'slide');
    expect(track).toHaveBeenLastCalledWith('Tab', 'Changed', 'PageKindSlide');
    expect(illustratePagesOf(h.tab())[0]).toMatchObject({ kind: 'slide', size: 'slide' });
  });
});

// docs/specs/007-editor/logo-pages.md "A logo page": a logo page is the artboard, keeps it, takes
// no pattern, and no other page takes the artboard.
describe('logo page edits', () => {
  const logoTab = (): Tab =>
    ({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'page-1', orientation: 'landscape', size: 'a3', kind: 'infographic' },
        { id: 'l1', orientation: 'portrait', size: 'logo', kind: 'logo' },
      ],
    }) as unknown as Tab;

  it('adds the artboard, and an infographic page modelled on the last infographic', async () => {
    const { track } = await import('@/lib/telemetry');
    const h = harness(logoTab());
    h.edits().addPage!('logo');
    expect(track).toHaveBeenLastCalledWith('Tab', 'Changed', 'LogoPageAdded');
    h.edits().addPage!('infographic');
    const [, , logo, page] = illustratePagesOf(h.tab());
    expect(logo).toMatchObject({ size: 'logo', kind: 'logo' });
    expect(page).toMatchObject({ orientation: 'landscape', size: 'a3' });
  });

  it('keeps the artboard: no other size, no turn, no pattern', () => {
    const h = harness(logoTab());
    h.edits().setSize('l1', 'square');
    h.edits().setOrientation('l1', 'landscape');
    h.edits().setBackground('l1', { pattern: 'dots' });
    expect(h.commitTabs).not.toHaveBeenCalled();
    h.edits().setBackground('l1', { fill: { kind: 'solid', color: '#101010' } });
    expect(illustratePagesOf(h.tab())[1]!.background).toEqual({
      fill: { kind: 'solid', color: '#101010' },
    });
  });

  it('never gives the artboard to another page', () => {
    const h = harness(logoTab());
    h.edits().setSize('page-1', 'logo');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });

  it('chooses Logo for the only, empty page', async () => {
    const { track } = await import('@/lib/telemetry');
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'page-1', orientation: 'portrait' }],
    } as unknown as Tab);
    h.edits().choosePageKind('page-1', 'logo');
    expect(track).toHaveBeenLastCalledWith('Tab', 'Changed', 'PageKindLogo');
    expect(illustratePagesOf(h.tab())[0]).toMatchObject({ kind: 'logo', size: 'logo' });
  });
});

describe('locking a page (docs/specs/007-editor/illustrate-pages.md "Locking a page")', () => {
  it('locks and unlocks a page, one edit each', () => {
    const h = harness(twoPages());
    h.edits().setLocked('page-1', true);
    expect(illustratePagesOf(h.tab())[0]!.locked).toBe(true);
    expect(h.edits().isLocked('page-1')).toBe(true);
    h.edits().setLocked('page-1', false);
    expect(illustratePagesOf(h.tab())[0]!.locked).toBeUndefined();
  });

  it('refuses every edit of a locked page, and duplicates it unlocked', () => {
    const h = harness(twoPages());
    h.edits().setLocked('page-1', true);
    const before = h.tab();
    h.edits().rename('page-1', 'New');
    h.edits().setOrientation('page-1', 'landscape');
    h.edits().setSize('page-1', 'a3');
    h.edits().setBackground('page-1', { fill: { kind: 'solid', color: '#000000' } });
    h.edits().applyLayout('page-1', 'top-tips');
    h.edits().removePage?.('page-1');
    expect(h.tab()).toBe(before);
    h.edits().duplicatePage?.('page-1');
    const copy = illustratePagesOf(h.tab())[1]!;
    expect(copy.id).not.toBe('page-1');
    expect(copy.locked).toBeUndefined();
  });

  it('starts a page blank once, never on a locked page', () => {
    const h = harness(twoPages());
    h.edits().startBlank('page-1');
    expect(illustratePagesOf(h.tab())[0]!.startedBlank).toBe(true);
    const after = h.tab();
    h.edits().startBlank('page-1');
    expect(h.tab()).toBe(after);
    h.edits().setLocked('page-2', true);
    h.edits().startBlank('page-2');
    expect(illustratePagesOf(h.tab())[1]!.startedBlank).toBeUndefined();
  });

  it("refuses the edits an article's pages share when any of them is locked", () => {
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' },
        { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f', locked: true },
      ],
      articles: { f: { blocks: [] } },
    } as unknown as Tab);
    const before = h.tab();
    h.edits().setOrientation('d1', 'landscape');
    h.edits().removePage?.('d1');
    expect(h.tab()).toBe(before);
  });

  it("renames an unlocked page of an article another of whose pages is locked: a name is a page's own", () => {
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f', locked: true },
        { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f' },
      ],
      articles: { f: { blocks: [] } },
    } as unknown as Tab);
    h.edits().rename('d2', 'Part two');
    expect(illustratePagesOf(h.tab())[1]!.name).toBe('Part two');
    h.edits().rename('d1', 'Part one');
    expect(illustratePagesOf(h.tab())[0]!.name).toBeUndefined();
  });

  it('gives a page only the sizes its kind offers', () => {
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' }],
      articles: { f: { blocks: [] } },
    } as unknown as Tab);
    h.edits().setSize('d1', 'slide');
    h.edits().setSize('d1', 'slide-classic');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/illustrate-pages.md "Sizes", "Split Into Pages".
describe('Fit to Content page edits', () => {
  const fitTab = (elements: Element[]): Tab =>
    ({
      id: 't',
      name: 'T',
      elements,
      pages: [
        {
          id: 'f',
          orientation: 'landscape',
          size: 'fit',
          fit: { width: 3000, height: 1000 },
          kind: 'infographic',
        },
      ],
    }) as unknown as Tab;

  it('never gives a page Fit to Content, and leaves its sides behind when sized away', () => {
    const plain = harness(twoPages());
    plain.edits().setSize('page-1', 'fit');
    expect(plain.commitTabs).not.toHaveBeenCalled();
    const h = harness(fitTab([box('a', 0)]));
    h.edits().setSize('f', 'a3');
    const page = illustratePagesOf(h.tab())[0]!;
    expect(page.size).toBe('a3');
    expect('fit' in page).toBe(false);
  });

  it('splits a page into a page per group, says so and goes to the first', () => {
    const h = harness(fitTab([box('a', -1200), box('b', 1200)]));
    h.edits().splitPage('f');
    const pages = illustratePagesOf(h.tab());
    expect(pages).toHaveLength(2);
    expect(h.toastInfo).toHaveBeenCalledWith('Split into 2 pages. Undo puts it back.');
    expect(h.onGoTo).toHaveBeenLastCalledWith(pages[0]!.id);
  });

  it('says there is nothing to split on a page that is one group', () => {
    const h = harness(fitTab([box('a', 0), box('b', 40)]));
    h.edits().splitPage('f');
    expect(illustratePagesOf(h.tab())).toHaveLength(1);
    expect(h.toastInfo).toHaveBeenCalledWith('This page is one group: nothing to split.');
    expect(h.onGoTo).not.toHaveBeenCalled();
  });

  it('adds an A4 page after a Fit to Content page, its sides being that page alone', () => {
    const h = harness(fitTab([box('a', 0)]));
    h.edits().addPage!('infographic');
    const added = illustratePagesOf(h.tab())[1]!;
    expect(added.size).toBeUndefined();
    expect('fit' in added).toBe(false);
  });

  it('says so at the page limit rather than splitting into one page', () => {
    const tab = fitTab([box('a', -1200), box('b', 1200)]);
    const rest = Array.from({ length: 99 }, (_, i) => ({ id: `p${i}`, orientation: 'portrait' }));
    const h = harness({ ...tab, pages: [...tab.pages!, ...rest] } as unknown as Tab);
    h.edits().splitPage('f');
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.toastInfo).toHaveBeenCalledWith(
      'A tab holds at most 100 pages: delete one to split this page.',
    );
  });

  it('refuses to split a locked page', () => {
    const tab = fitTab([box('a', -1200), box('b', 1200)]);
    const locked = {
      ...tab,
      pages: [{ ...(tab.pages![0] as object), locked: true }],
    } as unknown as Tab;
    const h = harness(locked);
    h.edits().splitPage('f');
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.toastInfo).not.toHaveBeenCalled();
  });
});
