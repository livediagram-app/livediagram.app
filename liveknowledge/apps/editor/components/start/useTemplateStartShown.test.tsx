// @vitest-environment jsdom

// The new knowledgebase's page waits for the start from its first frame (docs/specs/030-knowledgebase/
// describe-to-set-up.md "The start screen"): the rule is read in render, never from the panel's own (lazily loaded)
// mount, and the start is up only where /new offered it.
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import { closeKnowledgebaseStart, offerKnowledgebaseStart } from './knowledgebase-start';
import {
  emptyCardShownOf,
  useTemplateStartOpen,
  useTemplateStartShown,
} from './useTemplateStartShown';

type Ctx = {
  hydrated: boolean;
  zenMode: boolean;
  embedMode: boolean;
  pendingDraw: unknown;
  isReadOnly: boolean;
  activeTabConnected?: boolean;
  activeTab: Tab;
};
const fresh = (id = 't'): Tab => ({
  id,
  name: 'Start Here',
  elements: [],
  ...newKnowledgebasePageContent(),
});
const ctx = vi.hoisted((): { value: Ctx } => ({
  value: {
    hydrated: true,
    zenMode: false,
    embedMode: false,
    pendingDraw: null,
    isReadOnly: false,
    activeTab: undefined as unknown as Tab,
  },
}));
ctx.value.activeTab = fresh();
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.value }));

afterEach(() => {
  ctx.value.activeTab = fresh();
  sessionStorage.clear();
});

describe('useTemplateStartShown', () => {
  it('is on for a new knowledgebase page before any panel has mounted', () => {
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(true);
  });

  it('is off once the page has writing, for a page of no kind, or for a Viewer', () => {
    const tab = fresh();
    const flow = Object.keys(tab.articles!)[0]!;
    const blocks = tab.articles![flow]!.blocks;
    ctx.value.activeTab = {
      ...tab,
      articles: {
        [flow]: {
          ...tab.articles![flow]!,
          blocks: [blocks[0]!, { ...blocks[1]!, runs: [{ text: 'Hello' }] }],
        },
      },
    } as Tab;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTab = { id: 't', name: 'T', elements: [] };
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTab = fresh();
    ctx.value.isReadOnly = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.isReadOnly = false;
  });

  // A connected tab is empty but shows its own page (liveworkspace/docs/specs/004-index/connected-tabs.md).
  it('is off on a connected tab', () => {
    ctx.value.activeTabConnected = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTabConnected = false;
  });
});

describe('useTemplateStartOpen', () => {
  it('is open only on the tab /new offered it on, until a choice closes it', () => {
    const { result, rerender } = renderHook(() => useTemplateStartOpen());
    expect(result.current).toBe(false);
    act(() => offerKnowledgebaseStart('t'));
    expect(result.current).toBe(true);
    ctx.value.activeTab = fresh('other');
    rerender();
    expect(result.current).toBe(false);
    ctx.value.activeTab = fresh('t');
    rerender();
    expect(result.current).toBe(true);
    act(() => closeKnowledgebaseStart('t'));
    expect(result.current).toBe(false);
  });

  it('reads as not offered where storage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    offerKnowledgebaseStart('t');
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(false);
    get.mockRestore();
  });
});

// A Participant's or Viewer's untouched tab shows the empty-canvas card where an Editor's would show the start
// (liveworkspace/docs/specs/011-workbench/first-edit.md "The empty-canvas card").
describe('emptyCardShownOf', () => {
  const view = (over: Partial<Ctx>) =>
    ({ ...ctx.value, activeTabConnected: false, ...over }) as unknown as Parameters<
      typeof emptyCardShownOf
    >[0];

  it('is on for a Participant or Viewer on an untouched tab, never for an Editor (who sees the start)', () => {
    expect(emptyCardShownOf(view({ isReadOnly: true }))).toBe(true);
    expect(emptyCardShownOf(view({ isReadOnly: false }))).toBe(false);
  });

  it('is off on a connected tab or in zen', () => {
    expect(emptyCardShownOf(view({ isReadOnly: true, activeTabConnected: true }))).toBe(false);
    expect(emptyCardShownOf(view({ isReadOnly: true, zenMode: true }))).toBe(false);
  });
});
