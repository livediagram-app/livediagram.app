import { describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Element, type Tab } from '@livedesign/document';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Page actions": each edit is one tab commit.
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
    pageEdits({
      tabId: tab.id,
      tab: tabs[0]!,
      current: pagesOf(tabs[0]),
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

describe('Page edits', () => {
  it('renames, trimming, and clears an empty name', () => {
    const h = harness(twoPages());
    h.edits().rename('page-1', '  Intro  ');
    expect(pagesOf(h.tab())[0]!.name).toBe('Intro');
    h.edits().rename('page-1', '');
    expect(pagesOf(h.tab())[0]!.name).toBeUndefined();
  });

  it('stores A4 as no size, and skips a no-op', () => {
    const h = harness(twoPages());
    h.edits().setSize('page-1', 'a4');
    expect(h.commitTabs).not.toHaveBeenCalled();
    h.edits().setSize('page-1', 'square');
    expect(pagesOf(h.tab())[0]!.size).toBe('square');
    h.edits().setSize('page-1', 'a4');
    expect('size' in pagesOf(h.tab())[0]!).toBe(false);
  });

  it('moves a page with its content', () => {
    const h = harness(twoPages());
    h.edits().movePage('page-1', 1);
    expect(pagesOf(h.tab()).map((p) => p.id)).toEqual(['page-2', 'page-1']);
    const a = h.tab().elements.find((e) => e.id === 'a') as Element & { x: number };
    expect(a.x + 10).toBe(794 + 96);
  });

  // docs/specs/007-editor/pages-mode.md "Page actions": a delete never leaves nothing in view.
  it('goes to the page before a deleted one, or the next when the first goes', () => {
    const last = harness(twoPages());
    last.edits().removePage!('page-2');
    expect(last.onGoTo).toHaveBeenLastCalledWith('page-1');
    const first = harness(twoPages());
    first.edits().removePage!('page-1');
    expect(first.onGoTo).toHaveBeenLastCalledWith('page-2');
  });

  // docs/specs/007-editor/start-diagramming.md "Start Making Pages": the last page can go too.
  it('deletes the last page with everything on the tab, and brings Start Making Pages back', async () => {
    const { dismissEmptyCard, emptyCardDismissed } =
      await import('@/components/canvas/empty-card-dismissed');
    dismissEmptyCard('t:pages');
    const h = harness({
      id: 't',
      name: 'T',
      elements: [box('a', 0)],
      pages: [{ id: 'page-1', orientation: 'portrait', kind: 'infographic' }],
    } as unknown as Tab);
    h.edits().removePage!('page-1');
    expect(h.tab().elements).toEqual([]);
    expect(pagesOf(h.tab())).toHaveLength(1);
    expect(pagesOf(h.tab())[0]!.kind).toBeUndefined();
    expect(emptyCardDismissed('t:pages')).toBe(false);
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
    const ids = pagesOf(h.tab()).map((p) => p.id);
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
    expect(pagesOf(h.tab())[1]!.background?.pattern).toBe('dots');
    const commits = h.commitTabs.mock.calls.length;
    // The same again is no edit.
    h.edits().setBackground('page-2', { pattern: 'dots' });
    expect(h.commitTabs.mock.calls.length).toBe(commits);
    h.edits().setBackground('page-2', { fill: undefined, pattern: undefined });
    expect(pagesOf(h.tab())[1]!.background).toBeUndefined();
  });

  it('replaces a page with a layout inside its margins, leaving other pages alone', async () => {
    const h = harness(twoPages());
    expect(h.edits().contentCount('page-1')).toBe(1);
    await h.edits().applyLayout('page-1', 'key-stats');
    const els = h.tab().elements;
    expect(els.some((e) => e.id === 'a')).toBe(false);
    expect(els.some((e) => e.id === 'b')).toBe(true);
    expect(h.edits().contentCount('page-1')).toBe(els.length - 1);
    expect(h.onLayoutPlaced).toHaveBeenCalled();
  });

  it('carries what was written on the page into the new layout', async () => {
    const h = harness(twoPages());
    await h.edits().applyLayout('page-1', 'title');
    const written = h
      .tab()
      .elements.map((e) =>
        e.type === 'text' && e.label === 'Your big headline' ? { ...e, label: 'Q3 Results' } : e,
      );
    h.commitTabs((ts) => [{ ...ts[0]!, elements: written }]);
    await h.edits().applyLayout('page-1', 'poster');
    const labels = h.tab().elements.flatMap((e) => (e.type === 'text' ? [e.label] : []));
    expect(labels).toContain('Q3 Results');
    // The poster's own placeholder headline gave its place up.
    expect(labels).not.toContain('Make it bold');
    // The other page's content stays where it is.
    expect(h.tab().elements.some((e) => e.id === 'b')).toBe(true);
  });

  it('frames a turned or resized page again, as the view frames the page itself', () => {
    const h = harness(twoPages());
    h.edits().setOrientation('page-1', 'landscape');
    expect(h.onGoTo).toHaveBeenLastCalledWith('page-1');
    h.onGoTo.mockClear();
    h.edits().setSize('page-1', 'a3');
    expect(h.onGoTo).toHaveBeenLastCalledWith('page-1');
  });

  it('re-fits a full page into the page when it turns, text scaling with it', async () => {
    const h = harness(twoPages());
    await h.edits().applyLayout('page-1', 'top-tips');
    h.edits().setOrientation('page-1', 'landscape');
    const [page] = layOutPages(pagesOf(h.tab()));
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
    const [, , logo, page] = pagesOf(h.tab());
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
    expect(pagesOf(h.tab())[1]!.background).toEqual({
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
    expect(pagesOf(h.tab())[0]).toMatchObject({ kind: 'logo', size: 'logo' });
  });
});

describe('locking a page (docs/specs/007-editor/pages-mode.md "Locking a page")', () => {
  it('locks and unlocks a page, one edit each', () => {
    const h = harness(twoPages());
    h.edits().setLocked('page-1', true);
    expect(pagesOf(h.tab())[0]!.locked).toBe(true);
    expect(h.edits().isLocked('page-1')).toBe(true);
    h.edits().setLocked('page-1', false);
    expect(pagesOf(h.tab())[0]!.locked).toBeUndefined();
  });

  it('refuses every edit of a locked page, and duplicates it unlocked', async () => {
    const h = harness(twoPages());
    h.edits().setLocked('page-1', true);
    const before = h.tab();
    h.edits().rename('page-1', 'New');
    h.edits().setOrientation('page-1', 'landscape');
    h.edits().setSize('page-1', 'a3');
    h.edits().setBackground('page-1', { fill: { kind: 'solid', color: '#000000' } });
    await h.edits().applyLayout('page-1', 'top-tips');
    h.edits().removePage?.('page-1');
    expect(h.tab()).toBe(before);
    h.edits().duplicatePage?.('page-1');
    const copy = pagesOf(h.tab())[1]!;
    expect(copy.id).not.toBe('page-1');
    expect(copy.locked).toBeUndefined();
  });

  it('starts a page blank once, never on a locked page', () => {
    const h = harness(twoPages());
    h.edits().startBlank('page-1');
    expect(pagesOf(h.tab())[0]!.startedBlank).toBe(true);
    const after = h.tab();
    h.edits().startBlank('page-1');
    expect(h.tab()).toBe(after);
    h.edits().setLocked('page-2', true);
    h.edits().startBlank('page-2');
    expect(pagesOf(h.tab())[1]!.startedBlank).toBeUndefined();
  });

  it("renames an unlocked page beside a locked one: a name is a page's own", () => {
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        { id: 'd1', orientation: 'portrait', kind: 'infographic', locked: true },
        { id: 'd2', orientation: 'portrait', kind: 'infographic' },
      ],
    } as unknown as Tab);
    h.edits().rename('d2', 'Part two');
    expect(pagesOf(h.tab())[1]!.name).toBe('Part two');
    h.edits().rename('d1', 'Part one');
    expect(pagesOf(h.tab())[0]!.name).toBeUndefined();
  });

  it('gives a page only the sizes its kind offers', () => {
    const h = harness({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'd1', orientation: 'portrait', kind: 'infographic' }],
    } as unknown as Tab);
    h.edits().setSize('d1', 'logo');
    h.edits().setSize('d1', 'device');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/pages-mode.md "Sizes", "Split Into Pages".
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
    const page = pagesOf(h.tab())[0]!;
    expect(page.size).toBe('a3');
    expect('fit' in page).toBe(false);
  });

  it('splits a page into a page per group, says so and goes to the first', () => {
    const h = harness(fitTab([box('a', -1200), box('b', 1200)]));
    h.edits().splitPage('f');
    const pages = pagesOf(h.tab());
    expect(pages).toHaveLength(2);
    expect(h.toastInfo).toHaveBeenCalledWith('Split into 2 pages. Undo puts it back.');
    expect(h.onGoTo).toHaveBeenLastCalledWith(pages[0]!.id);
  });

  it('says what a split did and goes to its first page even when the commit runs later', () => {
    const tab = fitTab([box('a', -1200), box('b', 1200)]);
    const later: ((ts: Tab[]) => Tab[])[] = [];
    const toastInfo = vi.fn();
    const onGoTo = vi.fn();
    const edits = pageEdits({
      tabId: tab.id,
      tab,
      current: pagesOf(tab),
      elements: tab.elements,
      commitTabs: (map) => void later.push(map),
      onGoTo,
      onLayoutPlaced: vi.fn(),
      toastInfo,
    });
    edits.splitPage('f');
    expect(toastInfo).toHaveBeenCalledWith('Split into 2 pages. Undo puts it back.');
    const [after] = later[0]!([tab]);
    expect(onGoTo).toHaveBeenLastCalledWith(pagesOf(after)[0]!.id);
  });

  // docs/specs/003-system-architecture/react-state-and-effects.md "A handler decides before it commits": an edit that
  // cannot land (no longer editing, or the tab locked) says nothing and goes nowhere.
  it('neither tells nor glides for a split or duplicate that cannot land', () => {
    for (const blocked of [
      { tab: fitTab([box('a', -1200), box('b', 1200)]), mayEdit: () => false },
      {
        tab: { ...fitTab([box('a', -1200), box('b', 1200)]), locked: true } as Tab,
        mayEdit: () => true,
      },
    ]) {
      const toastInfo = vi.fn();
      const onGoTo = vi.fn();
      const commitTabs = vi.fn();
      const edits = pageEdits({
        tabId: blocked.tab.id,
        tab: blocked.tab,
        current: pagesOf(blocked.tab),
        elements: blocked.tab.elements,
        commitTabs,
        onGoTo,
        onLayoutPlaced: vi.fn(),
        toastInfo,
        mayEdit: blocked.mayEdit,
      });
      edits.splitPage('f');
      edits.duplicatePage?.('f');
      edits.addPage?.('infographic');
      expect(toastInfo).not.toHaveBeenCalled();
      expect(onGoTo).not.toHaveBeenCalled();
      expect(commitTabs).not.toHaveBeenCalled();
    }
  });

  it('says there is nothing to split on a page that is one group', () => {
    const h = harness(fitTab([box('a', 0), box('b', 40)]));
    h.edits().splitPage('f');
    expect(pagesOf(h.tab())).toHaveLength(1);
    expect(h.toastInfo).toHaveBeenCalledWith('This page is one group: nothing to split.');
    expect(h.onGoTo).not.toHaveBeenCalled();
  });

  it('adds an A4 page after a Fit to Content page, its sides being that page alone', () => {
    const h = harness(fitTab([box('a', 0)]));
    h.edits().addPage!('infographic');
    const added = pagesOf(h.tab())[1]!;
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
