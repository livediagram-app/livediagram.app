// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type EditorMode, type Tab } from '@livediagram/document';
import { useLeaveIllustrate } from './useLeaveIllustrate';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Leaving Illustrate (docs/specs/007-editor/editor-modes.md "Leaving Illustrate"): articles ask
// the articles question, other content a lighter confirmation, an empty tab switches at once.

const tab = (extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'Tab', elements: [], opensIn: 'illustrate', ...extra }) as Tab;

function setup(t: Tab) {
  const rawSet = vi.fn<(m: EditorMode) => void>();
  const { result } = renderHook(() =>
    useLeaveIllustrate(
      { mode: 'illustrate' as EditorMode, setMode: rawSet },
      { tab: t, canEdit: true, commitTabs: vi.fn() },
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
});
