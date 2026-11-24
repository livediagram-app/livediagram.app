// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGEBASE_FLOW,
  newKnowledgebasePageContent,
  pagesOf,
  withArticleHeightEstimated,
  type ArticleBlock,
  type Tab,
} from '@liveknowledge/document';
import { pageViewLens, lowerViewTabs } from '@/lib/page-surface/page-view-lens';
import {
  NARROW_ESTIMATE_DELAY_MS,
  useNarrowHeightEstimate,
  withNarrowHeightEstimated,
} from './useNarrowHeightEstimate';

// docs/specs/030-knowledgebase/blueprints/continuous-page.md "Who settles it, and when": writing done in the narrow
// view stores the estimator's full-width height once it rests, never the narrow measure.
const FLOW = KNOWLEDGEBASE_FLOW;
const para = (id: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text: 'A sentence that wraps a few times across the column. '.repeat(8) }],
});
const written = (): Tab => {
  const { pages } = newKnowledgebasePageContent();
  return {
    id: 't',
    name: 'Page',
    elements: [],
    pages,
    articles: { [FLOW]: { blocks: Array.from({ length: 30 }, (_, i) => para(`b${i}`)) } },
  };
};
const heightOf = (t: Tab) => pagesOf(t)[0]!.fit!.height;

describe('withNarrowHeightEstimated', () => {
  it("lowers to the stored page with the estimator's full-width height, and nothing else", () => {
    const real = written();
    const lens = pageViewLens(real, 300);
    const lifted = [lens];
    const mapped = withNarrowHeightEstimated(lifted, 't', FLOW);
    expect(mapped).not.toBe(lifted);
    const [out] = lowerViewTabs([real], lifted, mapped, 't');
    expect(heightOf(out!)).toBe(heightOf(withArticleHeightEstimated(real, FLOW)));
    expect(heightOf(out!)).toBeGreaterThan(heightOf(real));
    expect(out!.pages![0]!.fit!.width).toBe(real.pages![0]!.fit!.width);
    expect(out!.articles).toBe(real.articles);
    expect(out!.elements).toBe(real.elements);
  });

  it('changes nothing for a tab drawn full width, a locked one, or one already that tall', () => {
    const real = written();
    const wide = [real];
    expect(withNarrowHeightEstimated(wide, 't', FLOW)).toBe(wide);
    const locked = [pageViewLens({ ...real, locked: true }, 300)];
    expect(withNarrowHeightEstimated(locked, 't', FLOW)).toBe(locked);
    const settled = withArticleHeightEstimated(real, FLOW);
    const already = [pageViewLens(settled, 300)];
    expect(withNarrowHeightEstimated(already, 't', FLOW)).toBe(already);
    const other = [pageViewLens(real, 300)];
    expect(withNarrowHeightEstimated(other, 'nope', FLOW)).toBe(other);
  });
});

describe('useNarrowHeightEstimate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes once per pause, never per keystroke', () => {
    const tickTabs = vi.fn();
    const { result } = renderHook(() => useNarrowHeightEstimate('t', tickTabs));
    result.current(FLOW);
    vi.advanceTimersByTime(NARROW_ESTIMATE_DELAY_MS - 1);
    result.current(FLOW);
    vi.advanceTimersByTime(NARROW_ESTIMATE_DELAY_MS - 1);
    expect(tickTabs).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tickTabs).toHaveBeenCalledTimes(1);
    const lifted = [pageViewLens(written(), 300)];
    const map = tickTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    expect(map(lifted)).not.toBe(lifted);
  });

  it('drops a waiting estimate when the page goes', () => {
    const tickTabs = vi.fn();
    const { result, unmount } = renderHook(() => useNarrowHeightEstimate('t', tickTabs));
    result.current(FLOW);
    unmount();
    vi.advanceTimersByTime(NARROW_ESTIMATE_DELAY_MS * 2);
    expect(tickTabs).not.toHaveBeenCalled();
  });
});
