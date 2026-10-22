import { describe, expect, it, vi } from 'vitest';
import { chainDeleteGuards } from './delete-guards';

describe('chainDeleteGuards', () => {
  const ids = new Set(['x']);
  it('passes when neither asks', () => {
    expect(
      chainDeleteGuards(
        () => null,
        () => null,
      )(ids),
    ).toBeNull();
  });

  it('asks the second only after the first, and runs both releases', async () => {
    const order: string[] = [];
    const a = vi.fn(() => {
      order.push('a');
      return Promise.resolve({ release: () => order.push('ra') });
    });
    const b = vi.fn(() => {
      order.push('b');
      return Promise.resolve({ release: () => order.push('rb') });
    });
    const answer = await chainDeleteGuards(a, b)(ids);
    answer!.release();
    expect(order).toEqual(['a', 'b', 'ra', 'rb']);
  });

  it('cancels when the first is cancelled, without asking the second', async () => {
    const b = vi.fn(() => null);
    expect(await chainDeleteGuards(() => Promise.resolve(null), b)(ids)).toBeNull();
    expect(b).not.toHaveBeenCalled();
  });
});
