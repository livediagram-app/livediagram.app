import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  DAY_MS,
  networkUploadKey,
  networkUploadUsage,
  recordNetworkUpload,
  secondsToNextUtcDay,
  utcDay,
} from './network-upload-usage';

// docs/specs/009-elements/images.md "Per-network daily budget" (blueprint 7a, 15).
describe('network upload usage', () => {
  it('hashes the network under the signing secret, never storing the address', async () => {
    const a = await networkUploadKey({ GUEST_ID_HMAC_SECRET: 's1' }, '203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203.0.113.7');
    expect(await networkUploadKey({ GUEST_ID_HMAC_SECRET: 's1' }, '203.0.113.7')).toBe(a);
    expect(await networkUploadKey({ GUEST_ID_HMAC_SECRET: 's2' }, '203.0.113.7')).not.toBe(a);
    expect(await networkUploadKey({ GUEST_ID_HMAC_SECRET: 's1' }, '203.0.113.8')).not.toBe(a);
    // No secret (self-host): still a stable keyed hash.
    expect(await networkUploadKey({}, '203.0.113.7')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('adds each stored upload to the day, per network', async () => {
    const { env } = sqliteD1();
    const day = utcDay(Date.UTC(2026, 9, 7, 12));
    expect(await networkUploadUsage(env, 'net-a', day)).toEqual({ images: 0, bytes: 0 });
    await recordNetworkUpload(env, 'net-a', day, 1000);
    await recordNetworkUpload(env, 'net-a', day, 500);
    await recordNetworkUpload(env, 'net-b', day, 7);
    expect(await networkUploadUsage(env, 'net-a', day)).toEqual({ images: 2, bytes: 1500 });
    expect(await networkUploadUsage(env, 'net-b', day)).toEqual({ images: 1, bytes: 7 });
    // A new day starts from nothing.
    expect(await networkUploadUsage(env, 'net-a', day + 1)).toEqual({ images: 0, bytes: 0 });
  });

  it('keeps today and yesterday, and sweeps anything older', async () => {
    const { env, sql } = sqliteD1();
    const day = 20_000;
    await recordNetworkUpload(env, 'net-a', day - 5, 1);
    await recordNetworkUpload(env, 'net-a', day - 1, 1);
    await recordNetworkUpload(env, 'net-a', day, 1);
    const days = sql
      .prepare('SELECT day FROM network_upload_usage ORDER BY day')
      .all()
      .map((r) => (r as { day: number }).day);
    expect(days).toEqual([day - 1, day]);
  });

  it('counts down to the next UTC midnight', () => {
    const midday = Date.UTC(2026, 9, 7, 12);
    expect(secondsToNextUtcDay(midday)).toBe(12 * 3600);
    expect(secondsToNextUtcDay(utcDay(midday) * DAY_MS)).toBe(24 * 3600);
  });
});
