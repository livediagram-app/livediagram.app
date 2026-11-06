// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { buildTemplate } from '@livehuddle/templates';
import { historyCommit, historyUndo, type History } from './useDocumentHistory';
import { useTabTheme } from './useTabTheme';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// A theme pick is one step (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy Space eases the
// canvas, not its parts"): one commit of the whole Space, so one undo puts the old theme back on every element.
const space: Tab = {
  id: 't',
  name: 'Company Campus',
  elements: buildTemplate('company-campus', 0, 0),
};

describe('useTabTheme', () => {
  it('restyles a whole Space in one commit, and one undo restores it', () => {
    let history: History = { past: [], present: [space], future: [] };
    const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
      history = historyCommit(history, map);
    });
    const { result } = renderHook(() =>
      useTabTheme({ editsBlocked: false, activeId: 't', activeTab: space, commitTabs }),
    );
    result.current.setTheme('midnight');
    expect(commitTabs).toHaveBeenCalledTimes(1);
    expect(history.present[0]!.theme).toBe('midnight');
    expect(history.past).toHaveLength(1);
    history = historyUndo(history);
    expect(history.present[0]).toBe(space);
  });

  it('commits nothing while edits are blocked', () => {
    const commitTabs = vi.fn();
    const { result } = renderHook(() =>
      useTabTheme({ editsBlocked: true, activeId: 't', activeTab: space, commitTabs }),
    );
    result.current.setTheme('midnight');
    expect(commitTabs).not.toHaveBeenCalled();
  });
});
