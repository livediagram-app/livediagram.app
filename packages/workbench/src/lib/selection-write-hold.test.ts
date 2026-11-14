import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createOwnWrites, holdOwnWriteKeys, ownWriteKey } from './own-writes';
import { createSelectionStore } from './selection-store';
import {
  broadcastSelection,
  nextWriteHolds,
  selectionIdsOf,
  stillWritingIds,
  WRITE_HOLD_MAX_MS,
  type WriteHoldSources,
} from './selection-write-hold';

// docs/specs/007-editor/editor-app.md "Held until the holder's change lands" in every product (Work Tracker 659,
// Work Tracker 862).

type Box = { id: string; x: number; label?: string };
type BoxTab = { id: string; elements: Box[] };
const box = (id: string, x = 0): Box => ({ id, x });
const tab = (...elements: Box[]): BoxTab => ({ id: 't1', elements });

function sources(shown: BoxTab[], saved: BoxTab[]) {
  return {
    tabs: { current: shown },
    baseline: { current: saved },
    writes: createOwnWrites(),
  } satisfies WriteHoldSources;
}
const hold = (src: WriteHoldSources, ...ids: string[]) =>
  holdOwnWriteKeys(
    src.writes,
    ids.map((id) => ownWriteKey('t1', id)),
  );

describe('stillWritingIds', () => {
  it('reads an element as still being written while it differs from the baseline or its save is held', () => {
    const same = box('same');
    const src = sources(
      [tab(same, box('copy'), box('moved', 150), box('new'), box('held'))],
      [tab(same, box('copy'), box('moved'), box('held'))],
    );
    hold(src, 'held');
    expect(stillWritingIds(['same', 'copy', 'moved', 'new', 'held', 'gone'], 't1', src)).toEqual(
      new Set(['moved', 'new', 'held']),
    );
    // Another tab, or a tab nobody has, writes nothing; nor does a tab without elements.
    expect(stillWritingIds(['moved'], 't2', src)).toEqual(new Set());
    expect(stillWritingIds(['a'], 'x', sources([{ id: 'x' } as BoxTab], []))).toEqual(new Set());
    // Only held ids: the tabs are not read.
    expect(stillWritingIds(['held'], 't1', src)).toEqual(new Set(['held']));
  });
});

describe('nextWriteHolds', () => {
  const src = sources(
    [tab(box('a', 150), box('b'), box('c', 9))],
    [tab(box('a'), box('b'), box('c'))],
  );
  const none: ReadonlyMap<string, number> = new Map();

  it('holds what we let go of while still writing it, and nothing else', () => {
    const held = nextWriteHolds(none, new Set(['a', 'b']), new Set(), 't1', src, 100);
    expect([...held]).toEqual([['a', 100]]);
  });

  it('keeps the same map when nothing changes', () => {
    expect(nextWriteHolds(none, new Set(), new Set(['a']), 't1', src, 1)).toBe(none);
    const held = new Map([['a', 1]]);
    expect(nextWriteHolds(held, new Set(), new Set(), 't1', src, 2)).toBe(held);
    // Let go again of what is already held: still the same.
    expect(nextWriteHolds(held, new Set(['a']), new Set(), 't1', src, 3)).toBe(held);
  });

  it('lets go of one the selection takes back, one that has landed, and one held too long', () => {
    const held = new Map([
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ]);
    // `b` matches the baseline now; `a` is selected again; `c` is still unsaved.
    expect([...nextWriteHolds(held, new Set(['a']), new Set(['a']), 't1', src, 10)]).toEqual([
      ['c', 0],
    ]);
    expect(
      nextWriteHolds(new Map([['c', 0]]), new Set(), new Set(), 't1', src, WRITE_HOLD_MAX_MS).size,
    ).toBe(0);
  });
});

describe('nextWriteHolds: cost', () => {
  it('lets go of a 500-element selection on a 5,000-element tab of large elements within budget', () => {
    // A large element (an article's blocks, a table's cells) compared only when it is let go of.
    const body = 'x'.repeat(2_000);
    const shown = Array.from({ length: 5_000 }, (_, i) => ({
      ...box(`e${i}`, i + 1),
      label: body,
    }));
    const saved = shown.map((el) => ({ ...el, x: 0 }));
    const src = sources([tab(...shown)], [tab(...saved)]);
    const selected = new Set(shown.slice(0, 500).map((el) => el.id));
    let held: ReadonlyMap<string, number> = new Map();
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 5; i++) {
        held = nextWriteHolds(new Map(), selected, new Set(), 't1', src, 1);
      }
    });
    expect(held.size).toBe(500);
    expect(ms / 5).toBeLessThan(cpuBudgetMs(15));
  });
});

describe('selectionIdsOf', () => {
  it('reads the multi-selection plus the primary element, capped', () => {
    expect(selectionIdsOf({ selectedId: 'a', multiSelectedIds: new Set(['b', 'a']) }, 9)).toEqual([
      'b',
      'a',
    ]);
    expect(selectionIdsOf({ selectedId: null, multiSelectedIds: new Set(['b', 'c']) }, 1)).toEqual([
      'b',
    ]);
  });
});

describe('broadcastSelection', () => {
  afterEach(() => vi.useRealTimers());

  function holding(withWriting = true) {
    vi.useFakeTimers();
    const send = vi.fn();
    const selection = createSelectionStore();
    selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set(['b']) });
    const writing = sources([tab(box('a', 150), box('b'))], [tab(box('a'), box('b'))]);
    const stop = broadcastSelection({
      selection,
      tabId: 't1',
      maxIds: 50,
      writing: withWriting ? writing : undefined,
      send,
    });
    const last = () => send.mock.calls.at(-1) as [string | null, string[]];
    return { selection, writing, send, stop, last };
  }

  it('sends the selection now and on every change, and stops', () => {
    const { selection, send, stop, last } = holding(false);
    expect(send.mock.calls).toEqual([['a', ['b', 'a']]]);
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    // Without the hold's sources the lock ends with the selection, even for a moved element.
    expect(last()).toEqual([null, []]);
    stop();
    selection.setSelectedId('z');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('holds it until the save lands, then sends the selection without it', () => {
    const { selection, writing, send, last } = holding();
    const release = hold(writing, 'a');
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    // `a` was moved and its save waits for the room: still held. `b` is as saved: let go.
    expect(last()).toEqual([null, ['a']]);
    // The save landed: the baseline has the move and the room has sequenced it.
    writing.baseline.current = writing.tabs.current;
    release();
    vi.advanceTimersByTime(0);
    expect(last()).toEqual([null, []]);
    // Nothing more is held, so another release sends nothing.
    const sent = send.mock.calls.length;
    hold(writing)();
    vi.advanceTimersByTime(0);
    expect(send).toHaveBeenCalledTimes(sent);
  });

  it('keeps the selection and the held element apart, and a release that frees nothing sends nothing', () => {
    const { selection, writing, send, last } = holding();
    selection.setSelection({ selectedId: 'b', multiSelectedIds: new Set() });
    expect(last()).toEqual(['b', ['b', 'a']]);
    const sent = send.mock.calls.length;
    hold(writing)();
    vi.advanceTimersByTime(0);
    expect(send).toHaveBeenCalledTimes(sent);
  });

  it(`holds it no longer than ${WRITE_HOLD_MAX_MS} ms, and stops listening when stopped`, () => {
    const { selection, writing, send, stop, last } = holding();
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    expect(last()).toEqual([null, ['a']]);
    // A second let go while one is held moves the bound along with it.
    selection.setSelection({ selectedId: 'b', multiSelectedIds: new Set() });
    vi.advanceTimersByTime(WRITE_HOLD_MAX_MS);
    expect(last()).toEqual(['b', ['b']]);
    selection.setSelection({ selectedId: 'a', multiSelectedIds: new Set() });
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    expect(last()).toEqual([null, ['a']]);
    // A release queued before the stop sends nothing after it, and leaves no timer behind.
    hold(writing)();
    stop();
    const sent = send.mock.calls.length;
    vi.advanceTimersByTime(WRITE_HOLD_MAX_MS);
    expect(send).toHaveBeenCalledTimes(sent);
    expect(writing.writes.released.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// Two clients and the room, as in each product's realtime-peer-label.spec.ts: the owner moves a box and lets go of it;
// their autosave waits AUTOSAVE_MS, then its whole-element write takes NETWORK_MS to reach the room and as long again
// to be confirmed. The peer opens the box the moment the owner's lock lets it and types a label, which the room orders
// as one more whole-element write. The room keeps the last write of each element.
describe('two clients: a peer label typed just after the owner lets go of a moved box', () => {
  const AUTOSAVE_MS = 600;
  const NETWORK_MS = 80;
  afterEach(() => vi.useRealTimers());

  function run({ withHold, gap }: { withHold: boolean; gap: number }) {
    vi.useFakeTimers();
    const room = new Map<string, Box>([['box', box('box')]]);
    let locked: string[] = [];
    // The owner.
    const selection = createSelectionStore();
    const writing = sources([tab(box('box'))], [tab(box('box'))]);
    const stop = broadcastSelection({
      selection,
      tabId: 't1',
      maxIds: 50,
      writing: withHold ? writing : undefined,
      send: (_primary, ids) => void setTimeout(() => (locked = ids), NETWORK_MS),
    });
    selection.setSelectedId('box');
    vi.advanceTimersByTime(NETWORK_MS);
    const moved = { ...box('box'), x: 150 };
    writing.tabs.current = [tab(moved)];
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    setTimeout(() => {
      const snapshot = writing.tabs.current;
      const release = hold(writing, 'box');
      setTimeout(() => {
        room.set('box', moved);
        setTimeout(() => {
          writing.baseline.current = snapshot;
          release();
        }, NETWORK_MS);
      }, NETWORK_MS);
    }, AUTOSAVE_MS);
    // The peer: `gap` after the owner lets go, it tries every 50 ms until the box is free, then types.
    let typed = false;
    const tryType = () => {
      if (locked.includes('box')) return void setTimeout(tryType, 50);
      typed = true;
      setTimeout(() => room.set('box', { ...room.get('box')!, label: 'Peer text' }), NETWORK_MS);
    };
    setTimeout(tryType, gap);
    vi.advanceTimersByTime(AUTOSAVE_MS + 4 * NETWORK_MS + 1_000);
    stop();
    expect(typed).toBe(true);
    return room.get('box')!;
  }

  it.each([0, 150, 400])('loses the label without the hold (peer at %i ms)', (gap) => {
    expect(run({ withHold: false, gap }).label).toBeUndefined();
  });

  it.each([0, 150, 400, 1_200])(
    'keeps the label and the move with the hold (peer at %i ms)',
    (gap) => {
      expect(run({ withHold: true, gap })).toEqual({ id: 'box', x: 150, label: 'Peer text' });
    },
  );
});
