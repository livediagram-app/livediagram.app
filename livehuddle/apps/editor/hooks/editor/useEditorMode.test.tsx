// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
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
    expect(events).toEqual([['Editor', 'Changed', 'ModeDraw']]);
    expect(modeAtEvent).toEqual([undefined]);
    h.hook.rerender();
    expect(h.hook.result.current.mode).toBe('draw');
  });

  it('applies what leaving a mode brings in the same edit', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'workshop', elements: [] });
    act(() => h.hook.result.current.setMode('diagram', (t) => ({ ...t, name: 'Converted' })));
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tab()).toMatchObject({ opensIn: 'diagram', name: 'Converted' });
  });

  // docs/specs/003-system-architecture/react-state-and-effects.md "A handler decides before it commits": the switch
  // worked out is the one committed, so a board's conversion runs once, not twice.
  it('works the switch out once and commits that one', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'workshop', elements: [] });
    const convert = vi.fn((t: Tab) => ({ ...t, name: 'Converted' }));
    act(() => h.hook.result.current.setMode('diagram', convert));
    expect(convert).toHaveBeenCalledTimes(1);
    expect(h.tab()).toMatchObject({ opensIn: 'diagram', name: 'Converted' });
  });

  it('does nothing when asked for the mode already in use', () => {
    const h = setup({ id: 't', name: 'T', opensIn: 'draw', elements: [] });
    act(() => h.hook.result.current.setMode('draw'));
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('refuses a switch from a visitor, on a locked tab, or on an event-storming board', () => {
    const visitor = setup({ id: 't', name: 'T', opensIn: 'workshop', elements: [] }, false);
    expect(visitor.hook.result.current).toMatchObject({ mode: 'workshop', canSwitch: false });
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

  // One context value while nothing in it changes, so the chrome's switches re-render on a switch, not on every edit
  // of the tab (docs/specs/007-editor/blueprints/editor-modes.md "Performance and limits").
  it('returns the same object across an edit that leaves the mode alone', () => {
    const commitTabs = vi.fn();
    const deps = { canEdit: true, commitTabs, toastInfo: vi.fn() };
    const tab: Tab = { id: 't', name: 'T', elements: [] };
    const hook = renderHook(({ t }: { t: Tab }) => useEditorMode(t, deps), {
      initialProps: { t: tab },
    });
    const first = hook.result.current;
    hook.rerender({ t: { ...tab, name: 'Renamed' } });
    expect(hook.result.current).toBe(first);
    hook.rerender({ t: { ...tab, opensIn: 'draw' } });
    expect(hook.result.current).not.toBe(first);
    expect(hook.result.current.mode).toBe('draw');
  });
});
