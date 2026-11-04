import { describe, expect, it, vi } from 'vitest';
import { retypeFailedMessage, settleRetype, type SaveAlong } from './retype-settle';

// docs/specs/026-plan/item-types.md "Edit Field": Saving the type, all or none.
const step = () => ({ undo: vi.fn(), redo: vi.fn() });

function run(saved: boolean, along: SaveAlong) {
  const typeStep = step();
  const rollbackType = vi.fn();
  const push = vi.fn();
  const onError = vi.fn();
  const done = settleRetype({
    saved: Promise.resolve(saved),
    along,
    typeStep,
    rollbackType,
    push,
    onError,
  });
  return { done, typeStep, rollbackType, push, onError };
}

describe('a type change saved all or none', () => {
  it('takes the filters off and pushes one step tied to their canvas step once both land', async () => {
    const values = step();
    const settle = vi.fn(() => true);
    const r = run(true, {
      name: 'Size',
      values: Promise.resolve({ ok: true, step: values }),
      settle,
    });
    expect(await r.done).toBe(true);
    expect(settle).toHaveBeenCalledTimes(1);
    const pushed = r.push.mock.lastCall![0];
    expect(pushed.canvas).toBe(true);
    pushed.undo();
    expect(values.undo).toHaveBeenCalledTimes(1);
    expect(r.typeStep.undo).toHaveBeenCalledTimes(1);
  });

  it('pushes the type’s own step when nothing else changed', async () => {
    const r = run(true, { name: 'Size' });
    expect(await r.done).toBe(true);
    expect(r.push).toHaveBeenCalledWith(r.typeStep);
    // Filters that took nothing off make no canvas step.
    const s = run(true, { name: 'Size', settle: () => false });
    await s.done;
    expect(s.push.mock.lastCall![0].canvas).toBeUndefined();
  });

  it('puts back what landed and the type when the values write fails part way', async () => {
    const landed = step();
    const settle = vi.fn(() => true);
    const r = run(true, {
      name: 'Size',
      values: Promise.resolve({ ok: false, step: landed }),
      settle,
    });
    expect(await r.done).toBe(false);
    expect(landed.undo).toHaveBeenCalledTimes(1);
    expect(r.rollbackType).toHaveBeenCalledTimes(1);
    expect(settle).not.toHaveBeenCalled();
    expect(r.push).not.toHaveBeenCalled();
    expect(r.onError).toHaveBeenCalledWith(retypeFailedMessage('Size'));
    expect(retypeFailedMessage('Size')).toBe('Couldn’t change Size’s type, so nothing was changed.');
  });

  it('reads a values write that throws as nothing landed', async () => {
    const r = run(true, { name: 'Size', values: Promise.reject(new Error('offline')) });
    expect(await r.done).toBe(false);
    expect(r.rollbackType).toHaveBeenCalledTimes(1);
  });

  it('puts the values back, and nothing of the type, when the type can’t be saved', async () => {
    const values = step();
    const r = run(false, { name: 'Size', values: Promise.resolve({ ok: true, step: values }) });
    expect(await r.done).toBe(false);
    expect(values.undo).toHaveBeenCalledTimes(1);
    expect(r.rollbackType).not.toHaveBeenCalled();
    expect(r.onError).toHaveBeenCalledTimes(1);
  });
});
