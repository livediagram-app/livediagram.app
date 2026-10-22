import { describe, expect, it } from 'vitest';
import { waitUntil } from './wait-until';

describe('waitUntil', () => {
  it('resolves true at once when the condition already holds', async () => {
    expect(await waitUntil(() => true, 0)).toBe(true);
  });

  it('resolves true once the condition comes to hold', async () => {
    let ready = false;
    setTimeout(() => (ready = true), 60);
    expect(await waitUntil(() => ready, 1000)).toBe(true);
  });

  it('resolves false when time runs out', async () => {
    expect(await waitUntil(() => false, 80)).toBe(false);
  });
});
