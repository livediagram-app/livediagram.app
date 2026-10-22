import { describe, expect, it, vi } from 'vitest';
import { dropThenDisarm } from './palette-drop';

describe('dropThenDisarm', () => {
  it('lands the drop and then disarms the tile', () => {
    const order: string[] = [];
    const handler = dropThenDisarm(
      (kind: string) => order.push(`drop:${kind}`),
      () => order.push('disarm'),
    );
    handler('sticky');
    expect(order).toEqual(['drop:sticky', 'disarm']);
  });

  it('passes every argument through untouched', () => {
    const drop = vi.fn();
    dropThenDisarm(drop, () => {})('sticky', 10, 20, { choice: 'domain-event' });
    expect(drop).toHaveBeenCalledWith('sticky', 10, 20, { choice: 'domain-event' });
  });

  it('disarms even when the drop refuses', () => {
    // A locked tab or a blocked layer: the gesture is over either way, and an
    // armed tile the author has forgotten about is the surprise being fixed.
    const disarm = vi.fn();
    const handler = dropThenDisarm(() => {
      throw new Error('edits blocked');
    }, disarm);
    expect(() => handler()).toThrow('edits blocked');
    expect(disarm).toHaveBeenCalledTimes(1);
  });
});
