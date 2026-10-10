// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { useSplitView } from './useSplitView';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

const tab = (id: string) => ({ id, name: id, elements: [] }) as unknown as Tab;

type Props = { tabs: Tab[]; activeId: string; suspended?: boolean };

// The editor around the hook: selectTab moves the active tab, as the real one does.
function setup(initial: Props, failing: readonly string[] = []) {
  let props = initial;
  const loadTabs = vi.fn(async (ids: readonly string[]) =>
    ids.filter((id) => failing.includes(id)),
  );
  const view = renderHook(
    (p: Props) =>
      useSplitView({
        tabs: p.tabs,
        activeId: p.activeId,
        selectTab: (id) => {
          props = { ...props, activeId: id };
          view.rerender(props);
        },
        documentId: 'doc',
        hydrated: true,
        loadedTabIds: new Set(['a']),
        loadTabs,
        suspended: p.suspended ?? false,
      }),
    { initialProps: props },
  );
  const rerender = (next: Partial<Props>) => {
    props = { ...props, ...next };
    view.rerender(props);
  };
  return { view, rerender, loadTabs, active: () => props.activeId };
}

// docs/specs/007-editor/split-view.md
describe('useSplitView', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
    track.mockClear();
  });
  afterEach(() => window.localStorage.clear());

  it('opens a dragged tab on the right and fetches its content', () => {
    const { view, loadTabs } = setup({ tabs: [tab('a'), tab('b'), tab('c')], activeId: 'a' });
    act(() => view.result.current.open('c', 'Drag'));
    expect(view.result.current.pair).toEqual({ leftId: 'a', rightId: 'c' });
    expect(view.result.current.editorSide).toBe('left');
    expect(loadTabs).toHaveBeenCalledWith(['c']);
    expect(track).toHaveBeenCalledWith('Tab', 'Opened', 'SideBySideDrag');
  });

  it('moves the editor between panes without moving the tabs', () => {
    const { view, active } = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    act(() => view.result.current.focus('b', 'Hover'));
    expect(active()).toBe('b');
    expect(view.result.current.pair).toEqual({ leftId: 'a', rightId: 'b' });
    expect(view.result.current.editorSide).toBe('right');
    expect(track).toHaveBeenCalledWith('Tab', 'Selected', 'SideBySideHover');
    act(() => view.result.current.focus('a', 'Click'));
    expect(view.result.current.editorSide).toBe('left');
    expect(track).toHaveBeenCalledWith('Tab', 'Selected', 'SideBySideClick');
  });

  it('sends the active tab right and keeps the editor with it', () => {
    const { view, rerender, active } = setup({
      tabs: [tab('a'), tab('b'), tab('c')],
      activeId: 'c',
    });
    rerender({ activeId: 'b' });
    act(() => view.result.current.open('b', 'Menu'));
    expect(active()).toBe('b');
    expect(view.result.current.pair).toEqual({ leftId: 'c', rightId: 'b' });
    expect(view.result.current.editorSide).toBe('right');
  });

  it('edits the dropped tab when it lands in the pane the editor is in', () => {
    const { view, active } = setup({ tabs: [tab('a'), tab('b'), tab('c')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    act(() => view.result.current.focus('b', 'Click'));
    act(() => view.result.current.open('c', 'Drag'));
    expect(active()).toBe('c');
    expect(view.result.current.pair).toEqual({ leftId: 'a', rightId: 'c' });
  });

  it('opens a tab from the tab bar in the pane the editor is in', () => {
    const { view, rerender } = setup({ tabs: [tab('a'), tab('b'), tab('c')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    rerender({ activeId: 'c' });
    expect(view.result.current.pair).toEqual({ leftId: 'c', rightId: 'b' });
  });

  it('closes when a tab of the pair is deleted', () => {
    const { view, rerender } = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    rerender({ tabs: [tab('a')] });
    expect(view.result.current.pair).toBeNull();
  });

  it('closes when the editor’s tab of the pair is deleted and the editor falls to a third tab', () => {
    const { view, rerender } = setup({ tabs: [tab('a'), tab('b'), tab('c')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    act(() => view.result.current.focus('b', 'Click'));
    rerender({ tabs: [tab('a'), tab('c')], activeId: 'c' });
    expect(view.result.current.pair).toBeNull();
  });

  it('says so when the other pane’s tab cannot be fetched, instead of loading forever', async () => {
    const { view } = setup({ tabs: [tab('a'), tab('b'), tab('c')], activeId: 'a' }, ['c']);
    act(() => view.result.current.open('b', 'Drag'));
    await act(async () => {});
    expect(view.result.current.staticLoadFailed).toBe(false);
    act(() => view.result.current.open('c', 'Drag'));
    await act(async () => {});
    expect(view.result.current.staticLoadFailed).toBe(true);
  });

  it('steps aside while suspended and comes back after', () => {
    const { view, rerender } = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    rerender({ suspended: true });
    expect(view.result.current.available).toBe(false);
    expect(view.result.current.pair).toBeNull();
    rerender({ suspended: false });
    expect(view.result.current.pair).toEqual({ leftId: 'a', rightId: 'b' });
  });

  it('restores the pair, on its sides, on the next visit', () => {
    const first = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => first.view.result.current.open('b', 'Drag'));
    first.view.unmount();
    // The reload lands on the right tab; the editor comes back on the right.
    const second = setup({ tabs: [tab('a'), tab('b')], activeId: 'b' });
    expect(second.view.result.current.pair).toEqual({ leftId: 'a', rightId: 'b' });
    expect(second.view.result.current.editorSide).toBe('right');
  });

  it('offers nothing for a lone tab or the tab already on the right', () => {
    const lone = setup({ tabs: [tab('a')], activeId: 'a' });
    expect(lone.view.result.current.canOpen('a')).toBe(false);
    const pair = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => pair.view.result.current.open('b', 'Drag'));
    expect(pair.view.result.current.canOpen('b')).toBe(false);
  });

  it('closes and resizes within the minimums', () => {
    const { view } = setup({ tabs: [tab('a'), tab('b')], activeId: 'a' });
    act(() => view.result.current.open('b', 'Drag'));
    act(() => view.result.current.resize(5000, true));
    expect(view.result.current.rightWidth).toBe(1440 - 640);
    act(() => view.result.current.resetWidth());
    expect(view.result.current.rightWidth).toBe(720);
    act(() => view.result.current.close());
    expect(view.result.current.pair).toBeNull();
    expect(track).toHaveBeenCalledWith('Tab', 'Closed', 'SideBySide');
  });
});
