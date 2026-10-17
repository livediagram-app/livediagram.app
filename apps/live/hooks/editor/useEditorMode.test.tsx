// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { useEditorMode } from './useEditorMode';

const events: unknown[][] = [];
// What the tab's mode was when each event left: the event fires BEFORE the mode applies.
const modeAtEvent: (string | undefined)[] = [];
let tabs: Tab[] = [];
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => {
    events.push(args);
    modeAtEvent.push(tabs[0]?.opensIn);
  },
}));

const sticky = (id: string, x: number) =>
  ({ id, type: 'sticky', x, y: 0, width: 150, height: 92 }) as unknown as Element;

function setup(tab: Tab, canEdit = true) {
  tabs = [tab];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const toastInfo = vi.fn();
  const hook = renderHook(() => useEditorMode(tabs[0], { canEdit, commitTabs, toastInfo }));
  return { hook, commitTabs, toastInfo, tab: () => tabs[0]! };
}

// docs/specs/007-editor/editor-modes.md "Where the mode lives" and "Telemetry".
describe('useEditorMode', () => {
  beforeEach(() => {
    events.length = 0;
    modeAtEvent.length = 0;
  });

  it("reads the tab's own mode, switchable by an editor", () => {
    const { hook } = setup({ id: 't', name: 'T', opensIn: 'draw', elements: [] });
    expect(hook.result.current).toMatchObject({ mode: 'draw', canSwitch: true, canEdit: true });
  });

  it('switches by setting the tab’s mode, one tab edit, reported before it applies', () => {
    const h = setup({ id: 't', name: 'T', elements: [] });
    act(() => h.hook.result.current.setMode('draw'));
    expect(h.tab().opensIn).toBe('draw');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(events).toEqual([['Editor', 'Changed', 'ModeDrawing']]);
    expect(modeAtEvent).toEqual([undefined]);
    h.hook.rerender();
    expect(h.hook.result.current.mode).toBe('draw');
  });

  it('puts a board that does not fit onto a page in the same edit as entering Illustrate', () => {
    const h = setup({ id: 't', name: 'T', elements: [sticky('a', -1500), sticky('b', 1500)] });
    act(() => h.hook.result.current.setMode('illustrate'));
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tab()).toMatchObject({ opensIn: 'illustrate', pages: [{ size: 'fit' }] });
    expect(h.toastInfo).toHaveBeenCalledWith(
      'Put onto a page that fits it. Undo switches back to Diagram.',
    );
    expect(events).toContainEqual(['Tab', 'Changed', 'PageFitToContent']);
  });

  it('says the board went onto a page even when the commit runs later', () => {
    tabs = [{ id: 't', name: 'T', elements: [sticky('a', -1500), sticky('b', 1500)] }];
    const later: ((ts: Tab[]) => Tab[])[] = [];
    const toastInfo = vi.fn();
    const hook = renderHook(() =>
      useEditorMode(tabs[0], {
        canEdit: true,
        commitTabs: (map) => void later.push(map),
        toastInfo,
      }),
    );
    act(() => hook.result.current.setMode('illustrate'));
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual(['Tab', 'Changed', 'PageFitToContent']);
    tabs = later[0]!(tabs);
    expect(tabs[0]).toMatchObject({ opensIn: 'illustrate', pages: [{ size: 'fit' }] });
  });

  it('applies what leaving a mode brings in the same edit', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'illustrate', elements: [] });
    act(() => h.hook.result.current.setMode('diagram', (t) => ({ ...t, name: 'Converted' })));
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tab()).toMatchObject({ opensIn: 'diagram', name: 'Converted' });
  });

  // docs/specs/003-system-architecture/react-state-and-effects.md "A handler decides before it commits": the switch
  // worked out to decide the toast is the one committed, so a board's conversion runs once, not twice.
  it('works the switch out once and commits that one', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'illustrate', elements: [] });
    const convert = vi.fn((t: Tab) => ({ ...t, name: 'Converted' }));
    act(() => h.hook.result.current.setMode('diagram', convert));
    expect(convert).toHaveBeenCalledTimes(1);
    expect(h.tab()).toMatchObject({ opensIn: 'diagram', name: 'Converted' });
  });

  // "Plan stands apart", unless the tab is empty (docs/specs/007-editor/start-diagramming.md "Changing mode").
  it('crosses into and out of Plan while the tab is empty, and only then', () => {
    const empty = setup({ id: 't', name: 'T', elements: [] });
    expect(empty.hook.result.current.crossPlan).toBe(true);
    act(() => empty.hook.result.current.setMode('plan'));
    expect(empty.tab().opensIn).toBe('plan');
    empty.hook.rerender();
    act(() => empty.hook.result.current.setMode('diagram'));
    expect(empty.tab().opensIn).toBe('diagram');

    const full = setup({ id: 't', name: 'T', elements: [sticky('s', 0)] });
    expect(full.hook.result.current.crossPlan).toBeUndefined();
    act(() => full.hook.result.current.setMode('plan'));
    expect(full.tab().opensIn).toBeUndefined();
  });

  it('does nothing when asked for the mode already in use', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'draw', elements: [] });
    act(() => h.hook.result.current.setMode('draw'));
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('refuses a switch from a visitor, on a locked tab, or on an event-storming board', () => {
    const visitor = setup({ id: 't', name: 'T', opensIn: 'illustrate', elements: [] }, false);
    expect(visitor.hook.result.current).toMatchObject({ mode: 'illustrate', canSwitch: false });
    act(() => visitor.hook.result.current.setMode('draw'));
    expect(visitor.commitTabs).not.toHaveBeenCalled();
    const locked = setup({ id: 't', name: 'T', locked: true, elements: [] });
    act(() => locked.hook.result.current.setMode('draw'));
    expect(locked.commitTabs).not.toHaveBeenCalled();
    const es = setup({ id: 't', name: 'T', kind: 'event-storming', elements: [] });
    expect(es.hook.result.current.mode).toBe('diagram');
    act(() => es.hook.result.current.setMode('draw'));
    expect(es.commitTabs).not.toHaveBeenCalled();
  });
});
