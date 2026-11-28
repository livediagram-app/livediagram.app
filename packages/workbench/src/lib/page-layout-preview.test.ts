// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT_PREVIEW_SETTLE_MS } from './layout-preview-settle';
import { createPageLayoutPreview } from './page-layout-preview';

// liveworkspace/docs/specs/011-workbench/page-layout-preview.md (Work Tracker 1502, 1507): a hover and a press take
// one placing path, and a press on the layout shown lands the very elements shown. The editors' own tests drive it
// with their real builders and themes; this one pins every branch with a stand-in tab.

type El = { id: string; page: string; look?: string };
type T = { id: string; elements: El[]; locked?: string[] };
type Layout = 'a' | 'b';
type Build = (layout: Layout) => string;

let minted = 0;
// The stand-in placer: the page's elements replaced by one the layout makes, a fresh id each call.
const place = (tab: T, pageId: string, layout: Layout, build: Build): T | null =>
  pageId === 'gone' || tab.locked?.includes(pageId)
    ? null
    : {
        ...tab,
        elements: [
          ...tab.elements.filter((el) => el.page !== pageId),
          { id: `n${++minted}`, page: pageId, look: build(layout) },
        ],
      };

function setup() {
  const onPlace = vi.fn();
  const load = vi.fn(() => Promise.resolve<Build>((layout) => `themed-${layout}`));
  const preview = createPageLayoutPreview<T, Layout, Build>({ load, place, onPlace });
  let tab: T = { id: 't', elements: [{ id: 'x', page: 'p1' }] };
  const onLayoutPlaced = vi.fn();
  const edits = (locked: string[] = []) =>
    preview.pageLayoutEdits({
      tabId: 't',
      tab,
      elements: tab.elements,
      commitTab: (change) => {
        tab = change(tab) ?? tab;
      },
      isLocked: (id) => locked.includes(id),
      refusedLocked: (id) => locked.includes(id),
      onLayoutPlaced,
    });
  return { preview, edits, tab: () => tab, load, onPlace, onLayoutPlaced };
}

const settle = () => new Promise((r) => setTimeout(r, LAYOUT_PREVIEW_SETTLE_MS + 40));

afterEach(() => {
  vi.useRealTimers();
});

describe('createPageLayoutPreview', () => {
  it('a press on the layout a hover shows commits those very elements, ids and all, and puts the preview away', async () => {
    const h = setup();
    const board = h.tab().elements;
    h.edits().previewLayout('p1', 'a');
    await vi.waitFor(() => expect(h.preview.shownLayoutElements('t')).not.toBeNull());
    const shown = h.preview.shownLayoutElements('t')!;
    // Nothing written while it shows.
    expect(h.tab().elements).toBe(board);
    await h.edits().applyLayout('p1', 'a');
    expect(h.tab().elements).toBe(shown);
    expect(h.preview.shownLayoutElements('t')).toBeNull();
    expect(h.onPlace).toHaveBeenCalledTimes(1);
    expect(h.onLayoutPlaced).toHaveBeenCalledTimes(1);
    // The builders loaded once, for the hover and the press alike.
    expect(h.load).toHaveBeenCalledTimes(1);
  });

  it('places afresh, through the same placer, with no hover first or another layout shown', async () => {
    const h = setup();
    await h.edits().applyLayout('p1', 'b');
    expect(h.tab().elements.at(-1)!.look).toBe('themed-b');
    h.edits().previewLayout('p1', 'a');
    await vi.waitFor(() => expect(h.preview.shownLayoutElements('t')).not.toBeNull());
    const shown = h.preview.shownLayoutElements('t')!;
    await h.edits().applyLayout('p1', 'b');
    expect(h.tab().elements).not.toBe(shown);
    expect(h.tab().elements.at(-1)!.look).toBe('themed-b');
  });

  it('never commits what a hover showed over a board that has changed since', async () => {
    const h = setup();
    const before = h.edits();
    before.previewLayout('p1', 'a');
    await vi.waitFor(() => expect(h.preview.shownLayoutElements('t')).not.toBeNull());
    const shown = h.preview.shownLayoutElements('t')!;
    // Someone else's edit lands between the hover and the press; the press still holds the old board.
    const changed = { ...h.tab(), elements: [...h.tab().elements, { id: 'y', page: 'p2' }] };
    let committed: T | null = null;
    void h.preview
      .pageLayoutEdits({
        tabId: 't',
        tab: h.tab(),
        elements: h.tab().elements,
        commitTab: (change) => {
          committed = change(changed);
        },
        isLocked: () => false,
        refusedLocked: () => false,
        onLayoutPlaced: vi.fn(),
      })
      .applyLayout('p1', 'a');
    expect(committed!.elements).not.toBe(shown);
    expect(committed!.elements.some((el) => el.id === 'y')).toBe(true);
    expect(h.preview.shownLayoutFor('t', 'p1', 'a', [...h.tab().elements])).toBeNull();
    expect(h.preview.shownLayoutFor('t', 'p2', 'a', h.tab().elements)).toBeNull();
  });

  it('puts the page back when the hover ends, and draws nothing for a hover that has moved on', async () => {
    const h = setup();
    h.edits().previewLayout('p1', 'a');
    h.edits().previewLayout('p1', null);
    await settle();
    expect(h.preview.shownLayoutElements('t')).toBeNull();
    h.edits().previewLayout('p1', 'b');
    await vi.waitFor(() => expect(h.preview.shownLayoutElements('t')).not.toBeNull());
    h.edits().previewLayout('p1', null);
    await vi.waitFor(() => expect(h.preview.shownLayoutElements('t')).toBeNull());
  });

  it('draws nothing for a build answered after a newer ask', async () => {
    let release: (b: Build) => void = () => {};
    const preview = createPageLayoutPreview<T, Layout, Build>({
      load: () => new Promise<Build>((r) => (release = r)),
      place,
      onPlace: vi.fn(),
    });
    const tab: T = { id: 't', elements: [] };
    const edits = preview.pageLayoutEdits({
      tabId: 't',
      tab,
      elements: tab.elements,
      commitTab: vi.fn(),
      isLocked: () => false,
      refusedLocked: () => false,
      onLayoutPlaced: vi.fn(),
    });
    edits.previewLayout('p1', 'a');
    await settle();
    edits.previewLayout('p1', 'b', 'pointer');
    release((l) => l);
    await settle();
    await vi.waitFor(() => expect(preview.shownLayoutElements('t')!.at(-1)!.look).toBe('b'));
  });

  it('previews nothing on a locked or vanished page, and a locked page refuses the press', async () => {
    const h = setup();
    h.edits(['p1']).previewLayout('p1', 'a');
    h.edits().previewLayout('gone', 'a');
    await settle();
    expect(h.preview.shownLayoutElements('t')).toBeNull();
    const board = h.tab().elements;
    await h.edits(['p1']).applyLayout('p1', 'a');
    expect(h.tab().elements).toBe(board);
    expect(h.onPlace).not.toHaveBeenCalled();
  });

  it("shows a tab's preview to that tab's canvas only, and nothing on a server render", () => {
    const h = setup();
    const mine = renderHook(() => h.preview.useShownLayoutElements('t'));
    const other = renderHook(() => h.preview.useShownLayoutElements('u'));
    const elements = [{ id: 'z', page: 'p1' }];
    act(() => h.preview.showLayout({ tabId: 't', pageId: 'p1', layout: 'a', over: [], elements }));
    expect(mine.result.current).toBe(elements);
    expect(other.result.current).toBeNull();
    // The same again notifies nobody.
    act(() => h.preview.showLayout(null));
    act(() => h.preview.showLayout(null));
    expect(mine.result.current).toBeNull();
    const Probe = () => (h.preview.useShownLayoutElements('t') === null ? 'none' : 'some');
    expect(renderToString(createElement(Probe))).toBe('none');
  });
});
