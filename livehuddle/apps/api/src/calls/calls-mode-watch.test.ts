import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallsMode } from '@livehuddle/api-schema';
import { CALLS_MODE_CACHE_MS } from './calls-mode';
import { CallsModeWatch } from './calls-mode-watch';

// docs/specs/016-platform/calls-kill-switch.md "The room tells its clients".
function watch(start: CallsMode = 'on') {
  let mode = start;
  let now = 1_000;
  const reads: number[] = [];
  const told: CallsMode[] = [];
  const w = new CallsModeWatch({
    read: async () => {
      reads.push(now);
      return mode;
    },
    tell: (m) => told.push(m),
    now: () => now,
  });
  return {
    w,
    reads,
    told,
    set: (m: CallsMode) => (mode = m),
    advance: (ms: number) => (now += ms),
  };
}

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('CallsModeWatch', () => {
  it('reads the switch at most once a window, however many call ops pass', async () => {
    const t = watch();
    await t.w.note();
    for (let i = 0; i < 50; i++) expect(t.w.note()).toBeNull();
    expect(t.reads).toHaveLength(1);
    t.advance(CALLS_MODE_CACHE_MS);
    await t.w.note();
    expect(t.reads).toHaveLength(2);
  });

  it('says nothing while the mode is on, and tells every change once', async () => {
    const t = watch();
    await t.w.note();
    expect(t.told).toEqual([]);
    t.set('off');
    t.advance(CALLS_MODE_CACHE_MS);
    await t.w.note();
    t.advance(CALLS_MODE_CACHE_MS);
    await t.w.note();
    expect(t.told).toEqual(['off']);
    t.set('audio-only');
    t.advance(CALLS_MODE_CACHE_MS);
    await t.w.note();
    t.set('on');
    t.advance(CALLS_MODE_CACHE_MS);
    await t.w.note();
    expect(t.told).toEqual(['off', 'audio-only', 'on']);
  });

  it('starts from on, so a room that wakes into a paused switch tells it at once', async () => {
    const t = watch('off');
    await t.w.note();
    expect(t.told).toEqual(['off']);
  });

  it('reads on the real clock by default', async () => {
    const read = vi.fn(async () => 'on' as const);
    const w = new CallsModeWatch({ read, tell: () => {} });
    await w.note();
    expect(w.note()).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
