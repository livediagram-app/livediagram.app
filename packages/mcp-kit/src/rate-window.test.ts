import { describe, expect, it } from 'vitest';
import { overWindowLimit } from './rate-window';

// A KV that honours expirationTtl, as Cloudflare's does: each put sets the key's expiry from the moment it is written.
function ttlKv(clock: { now: number }) {
  const rows = new Map<string, { value: string; expiresAt: number }>();
  const kv = {
    async get(key: string) {
      const row = rows.get(key);
      return row && row.expiresAt > clock.now ? row.value : null;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const ttl = opts?.expirationTtl ?? Infinity;
      expect(ttl).toBeGreaterThanOrEqual(60);
      rows.set(key, { value, expiresAt: clock.now + ttl * 1000 });
    },
  };
  return kv as unknown as KVNamespace;
}

const HOUR = 3_600_000;
const limit = { max: 20, windowS: 3600 };

describe('overWindowLimit', () => {
  it('stops the 21st call in an hour, and lets only that address be stopped', async () => {
    const clock = { now: Date.UTC(2026, 10, 9, 10) };
    const kv = ttlKv(clock);
    for (let i = 0; i < 20; i++) expect(await overWindowLimit(kv, 'reg', '1.2.3.4', limit, clock.now)).toBe(false);
    expect(await overWindowLimit(kv, 'reg', '1.2.3.4', limit, clock.now)).toBe(true);
    expect(await overWindowLimit(kv, 'reg', '5.6.7.8', limit, clock.now)).toBe(false);
  });

  // A caller that never goes quiet for a whole hour still gets a fresh count each hour: a single key's expiry,
  // pushed back by every write, would have kept counting and refused it for good.
  it('never refuses a caller that keeps inside the limit, however steadily it calls', async () => {
    const clock = { now: Date.UTC(2026, 10, 9, 10) };
    const kv = ttlKv(clock);
    for (let i = 0; i < 100; i++) {
      clock.now += 50 * 60_000;
      expect(await overWindowLimit(kv, 'reg', '1.2.3.4', limit, clock.now)).toBe(false);
    }
  });

  it('starts counting again when the window turns', async () => {
    const clock = { now: Date.UTC(2026, 10, 9, 10, 59, 30) };
    const kv = ttlKv(clock);
    for (let i = 0; i < 20; i++) await overWindowLimit(kv, 'reg', 'a', limit, clock.now);
    expect(await overWindowLimit(kv, 'reg', 'a', limit, clock.now)).toBe(true);
    clock.now += 60_000;
    expect(await overWindowLimit(kv, 'reg', 'a', limit, clock.now)).toBe(false);
    clock.now += HOUR - 120_000;
    for (let i = 0; i < 19; i++) await overWindowLimit(kv, 'reg', 'a', limit, clock.now);
    expect(await overWindowLimit(kv, 'reg', 'a', limit, clock.now)).toBe(true);
  });
});
