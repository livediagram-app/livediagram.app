// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  articlesOf,
  createShape,
  type ArticleBlock,
  type EditorMode,
  type ShapeElement,
  type Tab,
} from '@livedesign/document';
import { useLeavePages } from './useLeavePages';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Only flow `a` has an open editor: what is typed there is taken into the pages.
const typed: ArticleBlock[] = [{ id: 'p', type: 'paragraph', runs: [{ text: 'Typed now' }] }];
const takeBlocks = vi.hoisted(() => vi.fn());
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: (flow: string) =>
    flow === 'a'
      ? {
          takeBlocks: () => {
            takeBlocks();
            return typed;
          },
          blocksByPage: () => [['p']],
        }
      : undefined,
}));

// Leaving Pages (docs/specs/007-editor/editor-modes.md "Leaving Pages"): articles ask
// the articles question, other content a lighter confirmation, an empty tab switches at once.

const tab = (extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'Tab',
  elements: [],
  opensIn: 'pages',
  ...extra,
});

function setup(t: Tab) {
  const rawSet = vi.fn<(m: EditorMode, alsoChange?: (t: Tab) => Tab) => void>();
  const { result } = renderHook(() =>
    useLeavePages({ mode: 'pages', setMode: rawSet }, { tab: t, canEdit: true }),
  );
  return { result, rawSet };
}

describe('leaving Pages', () => {
  it('switches an empty tab straight away', () => {
    const { result, rawSet } = setup(tab());
    act(() => result.current.editorMode.setMode('draw'));
    expect(rawSet).toHaveBeenCalledWith('draw');
    expect(result.current.leave.confirming).toBeNull();
  });

  it('asks first on a tab with content, and switches only when confirmed', () => {
    const { result, rawSet } = setup(tab({ elements: [createShape('square', 0, 0)] }));
    act(() => result.current.editorMode.setMode('diagram'));
    expect(rawSet).not.toHaveBeenCalled();
    expect(result.current.leave.confirming).toBe('diagram');
    act(() => result.current.leave.cancelSwitch());
    expect(rawSet).not.toHaveBeenCalled();
    act(() => result.current.editorMode.setMode('draw'));
    act(() => result.current.leave.confirmSwitch());
    expect(rawSet).toHaveBeenCalledWith('draw');
    expect(result.current.leave.confirming).toBeNull();
  });

  it('asks the articles question, not the confirmation, on a tab with articles', () => {
    const { result } = setup(
      tab({
        elements: [createShape('square', 0, 0)],
        articles: { a: { blocks: [] } },
      }),
    );
    act(() => result.current.editorMode.setMode('draw'));
    expect(result.current.leave.pending).toBe('draw');
    expect(result.current.leave.confirming).toBeNull();
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": Turn Into Pages and the switch
  // are one tab edit, so one undo puts the tab back in Pages with its articles.
  it('turns the articles into pages in the same edit as the switch', () => {
    const { result, rawSet } = setup(
      tab({
        elements: [createShape('square', 0, 0)],
        articles: { a: { blocks: [] } },
      }),
    );
    act(() => result.current.editorMode.setMode('diagram'));
    act(() => result.current.leave.convert());
    expect(rawSet).toHaveBeenCalledTimes(1);
    expect(rawSet.mock.calls[0]![0]).toBe('diagram');
    expect(typeof rawSet.mock.calls[0]![1]).toBe('function');
    expect(result.current.leave.pending).toBeNull();
  });

  it('the one edit takes in what is being typed and turns every article into Page elements', () => {
    const t = tab({
      elements: [createShape('square', 0, 0)],
      pages: [
        { id: 'pa', orientation: 'portrait', kind: 'article', flow: 'a' },
        { id: 'pb', orientation: 'portrait', kind: 'article', flow: 'b' },
      ],
      articles: {
        a: { blocks: [], style: { look: 'clean' } },
        b: { blocks: [{ id: 'q', type: 'paragraph', runs: [{ text: 'Saved' }] }] },
      },
    });
    const { result, rawSet } = setup(t);
    act(() => result.current.editorMode.setMode('diagram'));
    act(() => result.current.leave.convert());
    const out = rawSet.mock.calls[0]![1]!(t);
    expect(Object.keys(articlesOf(out))).toHaveLength(0);
    const pages = out.elements.filter(
      (e): e is ShapeElement => e.type === 'shape' && e.shape === 'page',
    );
    expect(pages).toHaveLength(2);
    expect(JSON.stringify(pages)).toContain('Typed now');
    expect(JSON.stringify(pages)).toContain('Saved');
  });

  it('the edit leaves an article gone by the time it lands alone', () => {
    const t = tab({
      elements: [createShape('square', 0, 0)],
      articles: { a: { blocks: [] } },
    });
    const { result, rawSet } = setup(t);
    act(() => result.current.editorMode.setMode('draw'));
    act(() => result.current.leave.convert());
    const without = { ...t, articles: {} } as Tab;
    expect(rawSet.mock.calls[0]![1]!(without).elements).toEqual(t.elements);
  });

  it('Keep switches with the articles left as they are; Cancel stays', () => {
    const { result, rawSet } = setup(
      tab({
        elements: [createShape('square', 0, 0)],
        articles: { a: { blocks: [] } },
      }),
    );
    act(() => result.current.editorMode.setMode('draw'));
    act(() => result.current.leave.cancel());
    expect(result.current.leave.pending).toBeNull();
    expect(rawSet).not.toHaveBeenCalled();
    act(() => result.current.editorMode.setMode('draw'));
    act(() => result.current.leave.keep());
    expect(rawSet).toHaveBeenCalledWith('draw');
    expect(result.current.leave.pending).toBeNull();
  });

  // docs/specs/007-editor/article-pages.md "Leaving Pages": a lock holds an article as it is.
  it('asks only the lighter question when every article has a locked page', () => {
    const { result } = setup(
      tab({
        pages: [{ id: 'pa', orientation: 'portrait', kind: 'article', flow: 'a', locked: true }],
        articles: { a: { blocks: [] } },
      }),
    );
    act(() => result.current.editorMode.setMode('draw'));
    expect(result.current.leave.pending).toBeNull();
    expect(result.current.leave.confirming).toBe('draw');
  });

  it("turns only the unlocked articles into pages, and never takes a locked one's writing", () => {
    takeBlocks.mockClear();
    const t = tab({
      pages: [
        { id: 'pa', orientation: 'portrait', kind: 'article', flow: 'a', locked: true },
        { id: 'pb', orientation: 'portrait', kind: 'article', flow: 'b' },
      ],
      articles: {
        a: { blocks: [{ id: 'k', type: 'paragraph', runs: [{ text: 'Held' }] }] },
        b: { blocks: [{ id: 'q', type: 'paragraph', runs: [{ text: 'Saved' }] }] },
      },
    });
    const { result, rawSet } = setup(t);
    act(() => result.current.editorMode.setMode('diagram'));
    expect(result.current.leave.pending).toBe('diagram');
    act(() => result.current.leave.convert());
    expect(takeBlocks).not.toHaveBeenCalled();
    const out = rawSet.mock.calls[0]![1]!(t);
    expect(Object.keys(articlesOf(out))).toEqual(['a']);
    expect(articlesOf(out).a!.blocks[0]).toMatchObject({ id: 'k' });
    const made = out.elements.filter(
      (e): e is ShapeElement => e.type === 'shape' && e.shape === 'page',
    );
    expect(made).toHaveLength(1);
    expect(JSON.stringify(made)).toContain('Saved');
    expect(JSON.stringify(made)).not.toContain('Held');
  });
});
