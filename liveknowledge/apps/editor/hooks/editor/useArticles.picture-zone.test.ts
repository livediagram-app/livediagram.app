// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KNOWLEDGEBASE_FLOW, newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import type { FlowLayout } from '@/components/canvas/article/article-editor-types';
import { clearArticleGrow, markArticleGrow } from '@/lib/article/article-grow-store';
import { useArticles } from './useArticles';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => null,
  markZoneReleased: vi.fn(),
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// Work Tracker 1425 rework: a page a Send to Knowledge Base wrote, its picture's zone placed by the write. Opening it
// to read (a Viewer, or an Editor in read mode) settles nothing, so it leaves no pending edit behind, even where the
// browser lays the zone out a few px from where the write put it.
const FLOW = KNOWLEDGEBASE_FLOW;
const sent = (opts: { locked?: boolean } = {}): Tab => {
  const content = newKnowledgebasePageContent();
  const doc = content.articles[FLOW]!;
  return {
    id: 't',
    name: 'Page',
    elements: [
      {
        id: 'img',
        type: 'image',
        x: 64,
        y: 120,
        width: 300,
        height: 150,
        imageId: 'i',
      },
    ],
    pages: content.pages,
    articles: {
      [FLOW]: {
        ...doc,
        blocks: [
          ...doc.blocks,
          {
            id: 'z',
            type: 'zone',
            zone: 'object',
            align: 'left',
            width: 300,
            height: 150,
            at: { page: content.pages[0]!.id, x: 64, y: 120 },
          },
        ],
      },
    },
    ...(opts.locked ? { locked: true } : {}),
  };
};
// The browser lays the zone out 6 px lower than the write's estimate.
const laidOut: FlowLayout = {
  flow: FLOW,
  pagesNeeded: 1,
  heightNeeded: 240,
  zones: [{ id: 'z', index: 0, x: 64, y: 126, width: 300, height: 150 }],
  notes: [],
  local: false,
};

function open(tab: Tab, canEdit: boolean, layout: FlowLayout = laidOut) {
  const tickTabs = vi.fn();
  const commitTabs = vi.fn();
  const hook = renderHook(() =>
    useArticles({
      activeTab: tab,
      on: true,
      pages: null,
      localEditSeq: { current: 0 },
      placeAt: vi.fn(),
      canEdit,
      canWrite: false,
      commitTabs,
      tickTabs,
      undo: vi.fn(),
      redo: vi.fn(),
      clearSelection: vi.fn(),
      openNote: vi.fn(),
      reveal: vi.fn(),
    }),
  );
  hook.result.current!.onLayout(layout);
  hook.result.current!.onLayout({ ...layout, local: true });
  // The tabs as every tick so far leaves them.
  const written = (ts: Tab[]): Tab[] =>
    (tickTabs.mock.calls as [(ts: Tab[]) => Tab[]][]).reduce((acc, [map]) => map(acc), ts);
  return { tickTabs, commitTabs, written };
}

beforeEach(() => {
  clearArticleGrow('t', FLOW);
  markArticleGrow('t', FLOW);
});

describe('a sent picture, opened to read', () => {
  it('a Viewer writes nothing', () => {
    const { tickTabs, commitTabs } = open(sent(), false);
    expect(tickTabs).not.toHaveBeenCalled();
    expect(commitTabs).not.toHaveBeenCalled();
  });

  it('an Editor in read mode writes nothing', () => {
    const { tickTabs, commitTabs } = open(sent({ locked: true }), true);
    expect(tickTabs).not.toHaveBeenCalled();
    expect(commitTabs).not.toHaveBeenCalled();
  });
});

// Round 2: the write places the zone where the estimate (which spaces blocks as the stylesheet does) puts it, so an
// Editor's Edit on a fresh send finds it settled: a layout within the settle tolerance (0.75 px) moves nothing.
describe('a sent picture, opened to edit', () => {
  it('writes nothing when the layout finds the zone where the write put it', () => {
    const tab = sent();
    const { commitTabs, written } = open(tab, true, {
      ...laidOut,
      zones: [{ id: 'z', index: 0, x: 64, y: 120.5, width: 300, height: 150 }],
    });
    expect(commitTabs).not.toHaveBeenCalled();
    expect(written([tab])[0]).toBe(tab);
  });

  it('settles a zone the layout finds further off', () => {
    const tab = sent();
    const { written } = open(tab, true);
    expect(written([tab])[0]).not.toBe(tab);
  });
});
