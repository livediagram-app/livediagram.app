import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@livediagram/document';
import { createOwnElementWrites, holdOwnWrites } from './own-element-writes';
import {
  nextWriteHolds,
  stillWritingIds,
  WRITE_HOLD_MAX_MS,
  type WriteHoldSources,
} from './selection-write-hold';

// docs/specs/007-editor/editor-app.md "Held until the holder's change lands" (Work Tracker 659).

const box = (id: string, x = 0) =>
  ({ id, type: 'shape', shape: 'square', x, y: 0, width: 10, height: 10 }) as Element;
const tab = (...elements: Element[]): Tab => ({ id: 't1', name: 'T', elements });

function sources(shown: Tab[], saved: Tab[]): WriteHoldSources {
  return {
    tabs: { current: shown },
    baseline: { current: saved },
    writes: createOwnElementWrites(),
  };
}

describe('stillWritingIds', () => {
  it('reads an element as still being written while it differs from the baseline or its save is held', () => {
    const same = box('same');
    const src = sources(
      [tab(same, box('copy'), box('moved', 150), box('new'), box('held'))],
      [tab(same, box('copy'), box('moved'), box('held'))],
    );
    holdOwnWrites(src.writes, 't1', [{ kind: 'update', element: box('held') }]);
    expect(stillWritingIds(['same', 'copy', 'moved', 'new', 'held', 'gone'], 't1', src)).toEqual(
      new Set(['moved', 'new', 'held']),
    );
    // Another tab, or a tab nobody has, writes nothing.
    expect(stillWritingIds(['moved'], 't2', src)).toEqual(new Set());
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
  it('lets go of a 500-element selection on a 5,000-element tab within budget', () => {
    const shown = Array.from({ length: 5_000 }, (_, i) => box(`e${i}`, i + 1));
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
