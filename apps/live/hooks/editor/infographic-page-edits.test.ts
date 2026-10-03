import { describe, expect, it, vi } from 'vitest';
import { infographicPagesOf, type Element, type Tab } from '@livediagram/document';
import { infographicPageEdits } from './infographic-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/infographic-pages.md "Page actions": each edit is one tab commit.
const box = (id: string, cx: number) =>
  ({ id, type: 'shape', shape: 'square', x: cx - 10, y: -10, width: 20, height: 20 }) as Element;

function harness(tab: Tab) {
  let tabs = [tab];
  const onCreated = vi.fn();
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    infographicPageEdits({
      tabId: tab.id,
      current: infographicPagesOf(tabs[0]!),
      commitTabs,
      onCreated,
    });
  return { edits, tab: () => tabs[0]!, commitTabs, onCreated };
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
    expect(infographicPagesOf(h.tab()).map((p) => p.id)).toEqual(['page-1', 'page-3', 'page-2']);
    expect(h.tab().elements).toHaveLength(3);
    expect(h.onCreated).toHaveBeenCalledWith('page-3');
  });

  it('paints and clears a background', () => {
    const h = harness(twoPages());
    h.edits().setBackground('page-2', {
      fill: { kind: 'solid', color: '#0f172a' },
      pattern: 'dots',
    });
    expect(infographicPagesOf(h.tab())[1]!.background?.pattern).toBe('dots');
    h.edits().setBackground('page-2', { fill: undefined, pattern: undefined });
    expect(infographicPagesOf(h.tab())[1]!.background).toBeUndefined();
  });
});
