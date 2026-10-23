import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, type Element, type Tab } from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { clearLocalPreview, localPreview } from '@/lib/drag-preview';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const tidyRuns = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/lib/page-tidy', async (real) => {
  const mod = await real<typeof import('@/lib/page-tidy')>();
  return {
    ...mod,
    tidyPageElements: (...args: Parameters<typeof mod.tidyPageElements>) => {
      tidyRuns.count += 1;
      return mod.tidyPageElements(...args);
    },
  };
});

// docs/specs/007-editor/pages-mode.md "Tidy": an infographic page's Tidy, one edit.
// Page 1 (A4 portrait) spans x -397..397; its content box starts at x -341.
const box = (id: string, x: number, y: number, more = {}) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 80, ...more }) as Element;
const xOf = (tab: Tab, id: string) => (tab.elements.find((e) => e.id === id) as { x: number }).x;

function harness(tab: Tab) {
  let tabs = [tab];
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
      layers: tabs[0]!.layers,
      commitTabs,
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
      toastInfo,
    });
  return { edits, tab: () => tabs[0]!, commitTabs, toastInfo };
}

const pageTab = (elements: Element[], page: Record<string, unknown> = {}): Tab =>
  ({
    id: 't',
    name: 'T',
    elements,
    pages: [
      { id: 'page-1', orientation: 'portrait', ...page },
      { id: 'page-2', orientation: 'portrait' },
    ],
  }) as unknown as Tab;

beforeEach(() => {
  vi.mocked(track).mockClear();
  clearLocalPreview();
});

describe('whether Tidy shows', () => {
  it('shows only while a press would change the page, and answers again after an edit', () => {
    const tidy = pageTab([box('a', -341, -305.5), box('b', -341, -105.5)]);
    expect(harness(tidy).edits().canTidy!('page-1')).toBe(false);
    // An empty page has nothing to tidy.
    expect(harness(tidy).edits().canTidy!('page-2')).toBe(false);
    const messy = pageTab([box('a', -200, -300), box('b', -196, -100)]);
    const h = harness(messy);
    expect(h.edits().canTidy!('page-1')).toBe(true);
    h.edits().tidyPage!('page-1');
    expect(h.edits().canTidy!('page-1')).toBe(false);
  });

  it('remembers the answer for the same board, so a re-render reruns no tidy', () => {
    const h = harness(pageTab([box('a', -200, -300), box('b', -196, -100)]));
    tidyRuns.count = 0;
    // Each render builds its edits afresh, with a fresh page list.
    for (let i = 0; i < 100; i++) h.edits().canTidy!('page-1');
    expect(tidyRuns.count).toBe(1);
  });

  it("keeps a page's answer through an edit on another page", () => {
    const other = box('far', 794 + 96 + 13, 0);
    const tab = pageTab([box('a', -200, -300), box('b', -196, -100), other]);
    const h = harness(tab);
    h.edits().canTidy!('page-1');
    tidyRuns.count = 0;
    h.commitTabs((ts) =>
      ts.map((t) => ({
        ...t,
        elements: t.elements.map((e) =>
          e.id === 'far' ? ({ ...e, x: (e as { x: number }).x + 40 } as typeof e) : e,
        ),
      })),
    );
    expect(h.edits().canTidy!('page-1')).toBe(true);
    expect(tidyRuns.count).toBe(0);
  });
});

describe('Tidy Up a page', () => {
  it('lines up the page’s elements in one edit, tracked, leaving other pages alone', () => {
    const other = box('far', 794 + 96 + 13, 0);
    const h = harness(pageTab([box('a', -200, -300), box('b', -196, -100), other]));
    h.edits().tidyPage!('page-1');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(xOf(h.tab(), 'a')).toBe(xOf(h.tab(), 'b'));
    expect(h.tab().elements[2]).toBe(other);
    expect(track).toHaveBeenCalledWith('Tab', 'Aligned', 'PageTidyUp');
    expect(h.toastInfo).not.toHaveBeenCalled();
  });

  it('tidies, and does not call the page tidy, when the commit runs later', () => {
    const tab = pageTab([box('a', -200, -300), box('b', -196, -100)]);
    const later: ((ts: Tab[]) => Tab[])[] = [];
    const toastInfo = vi.fn();
    pageEdits({
      tabId: tab.id,
      tab,
      current: pagesOf(tab),
      elements: tab.elements,
      commitTabs: (map) => void later.push(map),
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
      toastInfo,
    }).tidyPage!('page-1');
    expect(toastInfo).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Tab', 'Aligned', 'PageTidyUp');
    const [after] = later[0]!([tab]);
    expect(xOf(after!, 'a')).toBe(xOf(after!, 'b'));
  });

  it('says a tidy page is already tidy, writing and tracking nothing', () => {
    // On the margin, on the grid (from the content box's corner, y -505.5), sizes on the grid.
    const tab = pageTab([box('a', -341, -305.5), box('b', -341, -105.5)]);
    const h = harness(tab);
    h.edits().tidyPage!('page-1');
    expect(h.tab()).toBe(tab);
    expect(h.toastInfo).toHaveBeenCalledWith('This page is already tidy.');
    expect(track).not.toHaveBeenCalled();
  });

  it('leaves a locked page, and a locked layer’s elements, alone', () => {
    const locked = harness(pageTab([box('a', -200, -300), box('b', -196, -100)], { locked: true }));
    locked.edits().tidyPage!('page-1');
    expect(xOf(locked.tab(), 'b')).toBe(-196);
    const layered = harness({
      ...pageTab([
        box('a', -200, -300, { layerId: 'L' }),
        box('b', -337, -100, { layerId: 'base' }),
      ]),
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'L', name: 'L', locked: true },
      ],
    });
    layered.edits().tidyPage!('page-1');
    expect(xOf(layered.tab(), 'a')).toBe(-200);
    expect(xOf(layered.tab(), 'b')).toBe(-341);
  });

  it('tidies infographic and slide pages', () => {
    const slide = harness(
      pageTab([box('a', -200, -100), box('b', -196, 60)], {
        kind: 'slide',
        orientation: 'landscape',
      }),
    );
    expect(slide.edits().canTidy!('page-1')).toBe(true);
    slide.edits().tidyPage!('page-1');
    expect(xOf(slide.tab(), 'a')).toBe(xOf(slide.tab(), 'b'));
  });

  it('previews the tidied page without writing, and puts it back', () => {
    const h = harness(pageTab([box('a', -200, -300), box('b', -196, -100)]));
    h.edits().previewTidy!('page-1');
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(localPreview()?.tabId).toBe('t');
    h.edits().previewTidy!(null);
    expect(localPreview()).toBeNull();
    // A press while previewing commits and ends the preview.
    h.edits().previewTidy!('page-1');
    h.edits().tidyPage!('page-1');
    expect(localPreview()).toBeNull();
    expect(xOf(h.tab(), 'a')).toBe(xOf(h.tab(), 'b'));
  });
});
