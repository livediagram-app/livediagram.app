import { beforeEach, describe, expect, it, vi } from 'vitest';
import { illustratePagesOf, type Element, type Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { clearLocalPreview, localPreview } from '@/lib/drag-preview';
import { illustratePageEdits } from './illustrate-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Tidy Up": an infographic page's Tidy Up, one edit.
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
    illustratePageEdits({
      tabId: tab.id,
      current: illustratePagesOf(tabs[0]!),
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
    } as unknown as Tab);
    layered.edits().tidyPage!('page-1');
    expect(xOf(layered.tab(), 'a')).toBe(-200);
    expect(xOf(layered.tab(), 'b')).toBe(-341);
  });

  it('tidies only infographic pages', () => {
    const h = harness(pageTab([box('a', -300, -100)], { kind: 'slide', size: 'slide' }));
    h.edits().tidyPage!('page-1');
    expect(h.tab().elements[0]).toMatchObject({ x: -300 });
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
