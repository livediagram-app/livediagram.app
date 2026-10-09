// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useTabModeMenu } from './useTabModeMenu';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const general: Tab = { id: 'g', name: 'General', elements: [] };
const drawTab: Tab = { id: 'd', name: 'Draw', opensIn: 'draw', elements: [] };
const esBoard: Tab = { id: 'e', name: 'Wall', kind: 'event-storming', elements: [] };

function setup(tabs: Tab[], canEdit = true, activeId = tabs[0]!.id) {
  let state = tabs;
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    state = map(state);
  });
  const switchActive = vi.fn();
  const hook = renderHook(() => useTabModeMenu({ canEdit, commitTabs, activeId, switchActive }));
  return { hook, commitTabs, switchActive, tabs: () => state };
}

afterEach(() => vi.mocked(track).mockClear());

// docs/specs/007-editor/editor-modes.md "Where the mode lives": the tab menu's Mode.
describe('useTabModeMenu', () => {
  it("offers an editor the choice on a general tab, with the tab's mode", () => {
    const { hook } = setup([general, drawTab]);
    expect(hook.result.current.choiceFor(general)?.mode).toBe('diagram');
    expect(hook.result.current.choiceFor(drawTab)?.mode).toBe('draw');
  });

  it('offers no choice on an event-storming board, to a visitor, or on a locked tab', () => {
    expect(setup([esBoard]).hook.result.current.choiceFor(esBoard)).toBeUndefined();
    expect(setup([general], false).hook.result.current.choiceFor(general)).toBeUndefined();
    const locked = { ...general, locked: true };
    expect(setup([locked]).hook.result.current.choiceFor(locked)).toBeUndefined();
  });

  it('switches the active tab through the editor’s own switch', () => {
    const { hook, switchActive, commitTabs } = setup([drawTab, general]);
    act(() => hook.result.current.choiceFor(drawTab)!.onChange('illustrate'));
    expect(switchActive).toHaveBeenCalledWith('illustrate');
    expect(commitTabs).not.toHaveBeenCalled();
  });

  it('switches another tab as one tab edit, with what the mode brings, reported', () => {
    const wide = {
      ...general,
      elements: [
        { id: 'a', type: 'sticky', x: -1500, y: 0, width: 150, height: 92 },
        { id: 'b', type: 'sticky', x: 1500, y: 0, width: 150, height: 92 },
      ] as unknown as Element[],
    };
    const { hook, tabs, commitTabs } = setup([drawTab, wide]);
    act(() => hook.result.current.choiceFor(wide)!.onChange('illustrate'));
    expect(commitTabs).toHaveBeenCalledTimes(1);
    expect(tabs()[1]).toMatchObject({ opensIn: 'illustrate', pages: [{ size: 'fit' }] });
    expect(tabs()[0]).toBe(drawTab);
    expect(track).toHaveBeenCalledWith('Editor', 'Changed', 'ModeIllustrate');
  });

  it('does nothing for the mode the tab is already in', () => {
    const { hook, commitTabs, switchActive } = setup([general, drawTab]);
    act(() => hook.result.current.choiceFor(drawTab)!.onChange('draw'));
    act(() => hook.result.current.choiceFor(general)!.onChange('diagram'));
    expect(commitTabs).not.toHaveBeenCalled();
    expect(switchActive).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
