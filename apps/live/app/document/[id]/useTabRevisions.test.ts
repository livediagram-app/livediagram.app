// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTabRevisions } from './useTabRevisions';

// The last revision the editor knows for each tab (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "The selection reference"): its load and relayed changesets (the changeset-seen
// map), and its own saves' answers.

describe('useTabRevisions', () => {
  it('reads a tab it knows nothing of as revision 0', () => {
    const { result } = renderHook(() => useTabRevisions(new Map()));
    expect(result.current.revOf('t1')).toBe(0);
  });

  it('reads the revision a load or a relayed changeset noted', () => {
    const { result, rerender } = renderHook(({ seen }) => useTabRevisions(seen), {
      initialProps: { seen: new Map([['t1', 4]]) as ReadonlyMap<string, number> },
    });
    expect(result.current.revOf('t1')).toBe(4);

    rerender({ seen: new Map([['t1', 6]]) });

    expect(result.current.revOf('t1')).toBe(6);
  });

  it('reads the revision its own save was answered with', () => {
    const { result } = renderHook(() => useTabRevisions(new Map([['t1', 4]])));

    act(() => result.current.noteSaved('t1', 9));

    expect(result.current.revOf('t1')).toBe(9);
  });

  it('never moves back', () => {
    const { result, rerender } = renderHook(({ seen }) => useTabRevisions(seen), {
      initialProps: { seen: new Map([['t1', 4]]) as ReadonlyMap<string, number> },
    });
    act(() => result.current.noteSaved('t1', 9));
    act(() => result.current.noteSaved('t1', 7));
    rerender({ seen: new Map([['t1', 8]]) });

    expect(result.current.revOf('t1')).toBe(9);

    rerender({ seen: new Map([['t1', 11]]) });
    expect(result.current.revOf('t1')).toBe(11);
  });

  it('keeps one noteSaved across renders', () => {
    const { result, rerender } = renderHook(() => useTabRevisions(new Map()));
    const first = result.current.noteSaved;
    rerender();
    expect(result.current.noteSaved).toBe(first);
  });
});
