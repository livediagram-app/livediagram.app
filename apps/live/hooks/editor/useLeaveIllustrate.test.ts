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
} from '@livediagram/document';
import { useLeaveIllustrate } from './useLeaveIllustrate';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Only flow `a` has an open editor: what is typed there is taken into the pages.
const typed: ArticleBlock[] = [{ id: 'p', type: 'paragraph', runs: [{ text: 'Typed now' }] }];
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: (flow: string) =>
    flow === 'a' ? { takeBlocks: () => typed, blocksByPage: () => [['p']] } : undefined,
}));

// Leaving Illustrate (docs/specs/007-editor/editor-modes.md "Leaving Illustrate"): articles ask
// the articles question, other content a lighter confirmation, an empty tab switches at once.

const tab = (extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'Tab', elements: [], opensIn: 'illustrate', ...extra }) as Tab;

function setup(t: Tab) {
  const rawSet = vi.fn<(m: EditorMode, alsoChange?: (t: Tab) => Tab) => void>();
  const { result } = renderHook(() =>
    useLeaveIllustrate(
      { mode: 'illustrate' as EditorMode, setMode: rawSet },
      { tab: t, canEdit: true },
    ),
  );
  return { result, rawSet };
}

describe('leaving Illustrate', () => {
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
      } as Partial<Tab>),
    );
    act(() => result.current.editorMode.setMode('draw'));
    expect(result.current.leave.pending).toBe('draw');
    expect(result.current.leave.confirming).toBeNull();
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": Turn Into Pages and the switch
  // are one tab edit, so one undo puts the tab back in Illustrate with its articles.
  it('turns the articles into pages in the same edit as the switch', () => {
    const { result, rawSet } = setup(
      tab({
        elements: [createShape('square', 0, 0)],
        articles: { a: { blocks: [] } },
      } as Partial<Tab>),
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
    } as Partial<Tab>);
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
    } as Partial<Tab>);
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
      } as Partial<Tab>),
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
});
