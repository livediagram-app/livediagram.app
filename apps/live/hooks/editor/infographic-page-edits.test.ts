import { describe, expect, it, vi } from 'vitest';
import {
  infographicPagesOf,
  layOutInfographicPages,
  type Element,
  type Tab,
} from '@livediagram/document';
import { infographicPageEdits } from './infographic-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/infographic-pages.md "Page actions": each edit is one tab commit.
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
    infographicPageEdits({
      tabId: tab.id,
      current: infographicPagesOf(tabs[0]!),
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

describe('infographic page edits', () => {
  it('renames, trimming, and clears an empty name', () => {
    const h = harness(twoPages());
    h.edits().rename('page-1', '  Intro  ');
    expect(infographicPagesOf(h.tab())[0]!.name).toBe('Intro');
    h.edits().rename('page-1', '');
    expect(infographicPagesOf(h.tab())[0]!.name).toBeUndefined();
  });

  it('stores A4 as no size, and skips a no-op', () => {
    const h = harness(twoPages());
    h.edits().setSize('page-1', 'a4');
    expect(h.commitTabs).not.toHaveBeenCalled();
    h.edits().setSize('page-1', 'square');
    expect(infographicPagesOf(h.tab())[0]!.size).toBe('square');
    h.edits().setSize('page-1', 'a4');
    expect('size' in infographicPagesOf(h.tab())[0]!).toBe(false);
  });

  it('moves a page with its content', () => {
    const h = harness(twoPages());
    h.edits().movePage('page-1', 1);
    expect(infographicPagesOf(h.tab()).map((p) => p.id)).toEqual(['page-2', 'page-1']);
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
    const ids = infographicPagesOf(h.tab()).map((p) => p.id);
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
    expect(infographicPagesOf(h.tab())[1]!.background?.pattern).toBe('dots');
    const commits = h.commitTabs.mock.calls.length;
    // The same again is no edit.
    h.edits().setBackground('page-2', { pattern: 'dots' });
    expect(h.commitTabs.mock.calls.length).toBe(commits);
    h.edits().setBackground('page-2', { fill: undefined, pattern: undefined });
    expect(infographicPagesOf(h.tab())[1]!.background).toBeUndefined();
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
    const [page] = layOutInfographicPages(infographicPagesOf(h.tab()));
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
