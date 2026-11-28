// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newSessionTab, type Tab } from '@liveplanner/project';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { useSessionTabActions } from './useSessionTabActions';

// docs/specs/026-plan/session-tabs.md "Making one", "Real time": Start Session and a set-up change are one undo step
// each; running the session ticks the tab without history; a locked tab refuses every one.
const tab = (id: string, extra: Partial<Tab> = {}): Tab => ({
  id,
  name: 'Tab 2',
  elements: [],
  ...extra,
});
const SETUP = { typeIds: ['task'], statuses: ['backlog'] };

function setup(tabs: Tab[]) {
  let state = tabs;
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    state = map(state);
  });
  const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    state = map(state);
  });
  const { result } = renderHook(() =>
    useSessionTabActions({ activeId: 't1', commitTabs, tickTabs }),
  );
  return { actions: result.current, commitTabs, tickTabs, tabs: () => state };
}

describe('useSessionTabActions', () => {
  it('Start Session makes the open tab a Session tab named for its kind, one undo step', () => {
    const f = setup([tab('t1', { dashboard: { rows: [] } }), tab('t2')]);
    f.actions.startSession(newSessionTab('refinement', SETUP));
    const [made, other] = f.tabs();
    expect(made).toMatchObject({ kind: 'session', name: 'Refinement', dashboard: undefined });
    expect(made!.session?.setup).toEqual(SETUP);
    expect(other!.kind).toBeUndefined();
    expect(f.commitTabs).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'SessionTab');
    // A name someone gave the tab stays.
    const g = setup([tab('t1', { name: 'Backlog Grooming' })]);
    g.actions.startSession(newSessionTab('refinement', SETUP));
    expect(g.tabs()[0]!.name).toBe('Backlog Grooming');
  });

  it('changes the set-up in place, keeping the outcomes', () => {
    const session = {
      ...newSessionTab('refinement', SETUP),
      decided: { c1: { outcome: 'refined' as const, at: 1, by: 'Sam' } },
    };
    const f = setup([tab('t1', { kind: 'session', session }), tab('t2')]);
    f.actions.changeSetup({ ...SETUP, timeboxMs: 120_000 });
    expect(f.tabs()[0]!.session).toMatchObject({
      setup: { timeboxMs: 120_000 },
      decided: session.decided,
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'SessionSetup');
  });

  it('runs the session without history, and leaves the tabs alone when nothing changed', () => {
    const f = setup([tab('t1', { kind: 'session', session: newSessionTab('refinement', SETUP) })]);
    const before = f.tabs();
    f.actions.runSession('t1', (s) => s);
    expect(f.tabs()).toBe(before);
    f.actions.runSession('t1', (s) => ({ ...s, currentId: 'c1' }));
    expect(f.tabs()[0]!.session?.currentId).toBe('c1');
    expect(f.commitTabs).not.toHaveBeenCalled();
    expect(f.tickTabs).toHaveBeenCalledTimes(2);
  });

  it('a locked tab refuses every change', () => {
    const session = newSessionTab('refinement', SETUP);
    const f = setup([tab('t1', { kind: 'session', session, locked: true })]);
    const before = f.tabs();
    f.actions.startSession(newSessionTab('refinement', SETUP));
    f.actions.changeSetup({ ...SETUP, statuses: ['done'] });
    f.actions.runSession('t1', (s) => ({ ...s, currentId: 'c1' }));
    expect(f.tabs()[0]).toEqual(before[0]);
  });
});
