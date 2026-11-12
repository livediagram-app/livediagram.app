import { describe, expect, it, vi } from 'vitest';
import { guardRun } from './guard-run';

describe('guardRun', () => {
  it('calls through while the run is live and drops calls once it is superseded', () => {
    let live = true;
    const set = vi.fn((n: number) => n * 2);
    const guarded = guardRun({ set, label: 'kept' }, () => live);
    expect(guarded.set(2)).toBe(4);
    live = false;
    expect(guarded.set(3)).toBeUndefined();
    expect(set).toHaveBeenCalledTimes(1);
    expect(guarded.label).toBe('kept');
  });
});
