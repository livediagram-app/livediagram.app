// @vitest-environment jsdom
// Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs"): unopened tabs load first,
// every other tab is restyled in ONE commit (one undo step), and the toast tells what happened. An Editor's only.
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useApplyStyleToAllTabs } from './useApplyStyleToAllTabs';

type T = { id: string; locked?: boolean; elements: string[]; theme?: string };

const FOUR: T[] = [
  { id: 'a', elements: ['1'], theme: 'ocean' },
  { id: 'b', elements: ['2'] },
  { id: 'c', elements: ['3'], locked: true },
  { id: 'd', elements: [] },
];

function setup({ canApply = true, loaded = ['a', 'b', 'c'], start = FOUR } = {}) {
  const notify = vi.fn();
  const onApplied = vi.fn();
  const loadAllTabs = vi.fn(async () => {});
  const commits: number[] = [];
  const { result } = renderHook(() => {
    const [tabs, setTabs] = useState<T[]>(start);
    const hook = useApplyStyleToAllTabs<T>({
      canApply,
      activeId: 'a',
      loadAllTabs,
      isTabLoaded: (id) => loaded.includes(id),
      commitTabs: (map) => {
        commits.push(1);
        setTabs(map);
      },
      restyle: (t, s) => ({ ...t, theme: s.theme }),
      notify,
      onApplied,
    });
    return { tabs, ...hook };
  });
  return { result, notify, onApplied, loadAllTabs, commits };
}

describe('useApplyStyleToAllTabs', () => {
  it('loads every tab first, then restyles the rest in one commit and says how it went', async () => {
    const { result, notify, onApplied, loadAllTabs, commits } = setup();
    await act(async () => {
      await result.current.applyToAllTabs();
    });
    expect(loadAllTabs).toHaveBeenCalledTimes(1);
    expect(commits).toHaveLength(1);
    expect(result.current.tabs.map((t) => t.theme)).toEqual([
      'ocean',
      'ocean',
      undefined,
      undefined,
    ]);
    expect(notify).toHaveBeenCalledWith(
      'Applied this tab’s style to 1 other tab. 1 locked tab kept its own. 1 tab couldn’t load and kept its own.',
    );
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(result.current.applying).toBe(false);
  });

  it('does nothing for anyone but an Editor of the whole document', async () => {
    const { result, notify, loadAllTabs, commits } = setup({ canApply: false });
    await act(async () => {
      await result.current.applyToAllTabs();
    });
    expect(loadAllTabs).not.toHaveBeenCalled();
    expect(commits).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('tells, but counts no use, when no other tab could take the style', async () => {
    const { result, notify, onApplied } = setup({
      loaded: ['a'],
      start: [FOUR[0]!, FOUR[2]!, FOUR[3]!],
    });
    await act(async () => {
      await result.current.applyToAllTabs();
    });
    expect(notify).toHaveBeenCalledWith(
      'No other tab took this style. 1 locked tab kept its own. 1 tab couldn’t load and kept its own.',
    );
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('takes no second press while the first is still loading tabs', async () => {
    const { result, loadAllTabs } = setup();
    let release!: () => void;
    loadAllTabs.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    let first!: Promise<void>;
    act(() => {
      first = result.current.applyToAllTabs();
    });
    expect(result.current.applying).toBe(true);
    await act(async () => {
      await result.current.applyToAllTabs();
    });
    expect(loadAllTabs).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await first;
    });
    expect(result.current.applying).toBe(false);
  });
});
