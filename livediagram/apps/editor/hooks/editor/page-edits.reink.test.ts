import { describe, expect, it, vi } from 'vitest';
import { contrastRatio, pagesOf, type Element, type Tab } from '@livediagram/document';
import { applyOverlay, clearLocalPreview, localPreview } from '@/lib/drag-preview';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Re-inking": a new fill re-inks the page in the same
// edit, the hover preview draws what the press would write, and going back restores the author's
// colours from the session's memory.
const NAVY = '#1e293b';
const DARK = { kind: 'solid', color: '#0f172a' } as const;

function harness(tabId: string) {
  let tabs = [
    {
      id: tabId,
      name: 'T',
      elements: [
        {
          id: 'title',
          type: 'text',
          x: -40,
          y: -10,
          width: 80,
          height: 20,
          label: 'Hi',
          textColor: NAVY,
        },
      ],
      pages: [{ id: 'page-1', orientation: 'portrait' }],
    } as unknown as Tab,
  ];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    pageEdits({
      tabId,
      tab: tabs[0]!,
      current: pagesOf(tabs[0]),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
    });
  const title = (els = tabs[0]!.elements) =>
    (els.find((e) => e.id === 'title') as Element & { textColor: string }).textColor;
  return { edits, commitTabs, title };
}

describe('re-inking from the page panel', () => {
  it('re-inks in the same commit as the fill, and restores the author colour on the way back', () => {
    const h = harness('reink-a');
    h.edits().setBackground('page-1', { fill: DARK });
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(contrastRatio(h.title(), DARK.color)).toBeGreaterThanOrEqual(4.5);
    h.edits().setBackground('page-1', { fill: undefined });
    expect(h.commitTabs).toHaveBeenCalledTimes(2);
    expect(h.title()).toBe(NAVY);
  });

  it('previews the press exactly, memory included, and writes nothing', () => {
    const h = harness('reink-b');
    h.edits().setBackground('page-1', { fill: DARK });
    const dark = h.title();
    h.edits().previewInk({ pageId: 'page-1', patch: { fill: undefined } });
    const overlay = localPreview();
    expect(overlay?.tabId).toBe('reink-b');
    const shown = applyOverlay(
      [
        {
          id: 'title',
          type: 'text',
          x: -40,
          y: -10,
          width: 80,
          height: 20,
          textColor: dark,
        },
      ],
      overlay!,
    );
    expect(h.title(shown)).toBe(NAVY);
    expect(h.title()).toBe(dark);
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    h.edits().previewInk(null);
    expect(localPreview()).toBeNull();
    clearLocalPreview();
  });
});
