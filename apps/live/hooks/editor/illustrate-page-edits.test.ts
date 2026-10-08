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
  const onCreated = vi.fn();
  const onLayoutPlaced = vi.fn();
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    illustratePageEdits({
      tabId: tab.id,
      current: illustratePagesOf(tabs[0]!),
      elements: tabs[0]!.elements,
      commitTabs,
      onCreated,
      onLayoutPlaced,
    });
  return { edits, tab: () => tabs[0]!, commitTabs, onCreated, onLayoutPlaced };
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
    expect(h.onCreated).toHaveBeenCalledWith(ids[1]);
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
