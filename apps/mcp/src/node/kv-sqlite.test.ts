// The OAuth KV, over the process's own SQLite file (docs/specs/016-platform/self-hosted-runtime.md,
// "MCP process"). Real sqlite, real file: the point of this module is that a
// self-hosted deployment answers the same three calls a KV namespace does.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openKv, type SqliteKv } from './kv-sqlite';

describe('OAUTH_KV over SQLite', () => {
  const opened: SqliteKv[] = [];
  const dirs: string[] = [];

  function open(): SqliteKv {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-kv-'));
    dirs.push(dir);
    const kv = openKv(join(dir, 'mcp.sqlite'));
    opened.push(kv);
    return kv;
  }

  afterEach(() => {
    for (const kv of opened.splice(0)) kv.close();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('round-trips a string and a JSON record', async () => {
    const { binding } = open();
    await binding.put('client:abc', JSON.stringify({ clientName: 'CLI' }));
    expect(await binding.get('client:abc')).toBe('{"clientName":"CLI"}');
    expect(await binding.get<{ clientName: string }>('client:abc', 'json')).toEqual({
      clientName: 'CLI',
    });
  });

  it('answers null for a key that was never written or has been deleted', async () => {
    const { binding } = open();
    expect(await binding.get('missing')).toBeNull();
    await binding.put('code:1', 'x');
    await binding.delete('code:1');
    expect(await binding.get('code:1')).toBeNull();
  });

  it('stops answering a key once its TTL has passed, and drops the row', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const kv = open();
    await kv.binding.put('code:short', 'token', { expirationTtl: 300 });
    expect(await kv.binding.get('code:short')).toBe('token');

    vi.setSystemTime(new Date('2026-01-01T00:05:01Z'));
    expect(await kv.binding.get('code:short')).toBeNull();
    // The read that found it expired deleted it, so nothing is left to sweep.
    expect(kv.sweep()).toBe(0);
  });

  it('keeps a key with no TTL forever, and sweeps the ones that have one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const kv = open();
    await kv.binding.put('client:forever', 'kept');
    await kv.binding.put('rate:1.2.3.4', '3', { expirationTtl: 3600 });

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    expect(kv.sweep()).toBe(1);
    expect(await kv.binding.get('client:forever')).toBe('kept');
    expect(await kv.binding.get('rate:1.2.3.4')).toBeNull();
  });

  it('rewrites a key in place rather than failing on the second put', async () => {
    const { binding } = open();
    await binding.put('device:abc', '{"polls":1}');
    await binding.put('device:abc', '{"polls":2}');
    expect(await binding.get('device:abc')).toBe('{"polls":2}');
  });
});
