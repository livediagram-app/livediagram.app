// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useTabOpensIn } from './useTabOpensIn';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const general: Tab = { id: 'g', name: 'General', elements: [] };
const drawTab: Tab = { id: 'd', name: 'Draw', opensIn: 'draw', elements: [] };
const esBoard: Tab = { id: 'e', name: 'Wall', kind: 'event-storming', elements: [] };

function setup(tabs: Tab[], canEdit = true) {
  let state = tabs;
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    state = map(state);
  });
  const emitTabMeta = vi.fn();
  const hook = renderHook(() => useTabOpensIn({ tabs: state, canEdit, commitTabs, emitTabMeta }));
  return { hook, commitTabs, emitTabMeta, tabs: () => state };
}

afterEach(() => vi.mocked(track).mockClear());

// docs/specs/007-editor/editor-modes.md "Opens in".
describe('useTabOpensIn', () => {
  it('offers an editor the choice on a general tab, with its opening mode', () => {
    const { hook } = setup([general, drawTab]);
    expect(hook.result.current.choiceFor(general)).toMatchObject({
      mode: 'diagram',
      disabled: false,
    });
    expect(hook.result.current.choiceFor(drawTab)?.mode).toBe('draw');
  });

  it('offers no choice on an event-storming board, nor to a visitor who cannot edit', () => {
    expect(setup([esBoard]).hook.result.current.choiceFor(esBoard)).toBeUndefined();
    expect(setup([general], false).hook.result.current.choiceFor(general)).toBeUndefined();
  });

  it('greys the choice out on a locked tab', () => {
    const locked = { ...general, locked: true };
    expect(setup([locked]).hook.result.current.choiceFor(locked)?.disabled).toBe(true);
  });

  it('sets the opening mode for everyone as one tab edit, reported and logged', () => {
    const { hook, tabs, commitTabs, emitTabMeta } = setup([general, drawTab]);
    act(() => hook.result.current.choiceFor(general)!.onChange('draw'));
    expect(tabs()[0]!.opensIn).toBe('draw');
    expect(tabs()[1]).toBe(drawTab);
    expect(commitTabs).toHaveBeenCalledTimes(1);
    expect(emitTabMeta).toHaveBeenCalledWith('g', 'Opens in Draw');
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'OpensInDraw');
  });

  it('changes nothing for the mode the tab already opens in, or on a locked tab', () => {
    const locked = { ...general, id: 'l', locked: true };
    const { hook, commitTabs } = setup([drawTab, locked]);
    act(() => hook.result.current.choiceFor(drawTab)!.onChange('draw'));
    act(() => hook.result.current.choiceFor(locked)!.onChange('draw'));
    expect(commitTabs).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
