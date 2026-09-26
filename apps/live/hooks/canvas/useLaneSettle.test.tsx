// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/diagram';
import { settleToast, useLaneSettle } from './useLaneSettle';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));

// The one-time settle of an older event-storming board
// (docs/specs/021-event-storming/event-storming.md "Always on a lane": older boards settle once).

function note(id: string, y: number, over: Partial<Element> = {}): Element {
  return {
    id,
    type: 'sticky',
    x: 0,
    y,
    width: 200,
    height: 200,
    esKind: 'domain-event',
    fillColor: '#fdba74',
    fixedSize: true,
    ...over,
  } as Element;
}

function harness(initial: Tab, opts: { editsBlocked?: boolean } = {}) {
  let tab = initial;
  const commits: Tab[] = [];
  const toastInfo = vi.fn();
  const marks: string[] = [];
  const view = renderHook(
    ({ blocked }: { blocked: boolean }) =>
      useLaneSettle({
        activeTab: tab,
        editsBlocked: blocked,
        commitActiveTab: (map) => {
          tab = map(tab);
          commits.push(tab);
        },
        markSettled: (id) => {
          marks.push(id);
          tab = { ...tab, esLanesSettled: true };
        },
        toastInfo,
      }),
    { initialProps: { blocked: opts.editsBlocked === true } },
  );
  return {
    view,
    commits,
    marks,
    toastInfo,
    get tab() {
      return tab;
    },
    rerender: (blocked: boolean) => view.rerender({ blocked }),
  };
}

const esTab = (elements: Element[], over: Partial<Tab> = {}) =>
  ({ id: 't1', name: 'Board', kind: 'event-storming', elements, ...over }) as Tab;

afterEach(() => {
  cleanup();
  track.mockReset();
});

describe('useLaneSettle', () => {
  it('lines an older board up on the lanes once, as one step, and says so', () => {
    const h = harness(esTab([note('a', 130), note('b', 240), note('c', 610)]));
    expect(h.commits).toHaveLength(1);
    expect(h.tab.esLanesSettled).toBe(true);
    expect(h.tab.elements.map((e) => (e as { y: number }).y)).toEqual([240, 240, 720]);
    expect(h.toastInfo).toHaveBeenCalledWith('Lined up 2 notes on the lanes.');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'LanesSettled');
  });

  it('marks a board with nothing to move without an undo step', () => {
    const h = harness(esTab([note('a', 240)]));
    expect(h.commits).toHaveLength(0);
    expect(h.marks).toEqual(['t1']);
    expect(h.toastInfo).not.toHaveBeenCalled();
  });

  it('never settles a board already marked, so a free-placed note stays', () => {
    const h = harness(esTab([note('a', 130)], { esLanesSettled: true }));
    expect(h.commits).toHaveLength(0);
    expect(h.marks).toEqual([]);
  });

  it('waits while edits are blocked (a view-only visitor, a locked or unloaded tab)', () => {
    const h = harness(esTab([note('a', 130)]), { editsBlocked: true });
    expect(h.commits).toHaveLength(0);
    h.rerender(false);
    expect(h.commits).toHaveLength(1);
  });

  it('settles a tab at most once a session, even if an undo takes the mark away', () => {
    const h = harness(esTab([note('a', 130)]));
    expect(h.commits).toHaveLength(1);
    h.rerender(false);
    expect(h.commits).toHaveLength(1);
  });

  it('leaves an ordinary board alone', () => {
    const h = harness({ id: 't1', name: 'D', elements: [note('a', 130)] } as Tab);
    expect(h.commits).toHaveLength(0);
    expect(h.marks).toEqual([]);
  });

  it('words the toast for one note', () => {
    expect(settleToast(1)).toBe('Lined up 1 note on the lanes.');
  });
});
