import { describe, expect, it } from 'vitest';
import type { ReadCopy } from '@livediagram/agent-verbs';
import { fakeIo } from '../testing/fake-io';
import { fileReadCopies, READ_COPY_MAX_BYTES, READ_COPY_REVS_PER_TAB } from './read-copies';

const copy = (rev: number, label = 'x'): ReadCopy => ({
  rev,
  tab: { id: 't', name: 'T', elements: [{ id: 'n1', label }] } as never,
});
const ROOT = '/home/agent/.cache/livediagram/copies';

describe('fileReadCopies', () => {
  it('keeps copies at 0600 under a hashed key, newest first for latest, and logs hits and misses', async () => {
    const io = fakeIo();
    const logs: string[] = [];
    const copies = fileReadCopies(io, 'default', (line) => void logs.push(line));
    expect(await copies.latest('d', 't')).toBeNull();
    await copies.record('d', 't', copy(4));
    await copies.record('d', 't', copy(6));
    await copies.record('d', 't', copy(5));
    expect(await copies.latest('d', 't')).toEqual(copy(6));
    expect(await copies.at('d', 't', 5)).toEqual(copy(5));
    expect(await copies.at('d', 't', 9)).toBeNull();
    expect(await copies.revisions('d', 't')).toEqual([4, 5, 6]);
    const files = [...io.fileMap.entries()].filter(([path]) => path.startsWith(ROOT));
    expect(files.every(([, f]) => f.mode === 0o600)).toBe(true);
    expect(
      files
        .map(([path]) => path)
        .filter((p) => p.endsWith('.json') && !p.endsWith('index.json'))[0],
    ).toMatch(/copies\/[0-9a-f]{16}\/4\.json$/);
    expect(logs).toEqual([
      'copy miss d/t',
      'copy hit d/t rev 6',
      'copy hit d/t rev 5',
      'copy miss d/t',
    ]);
  });

  it('keeps the newest revisions of a tab, re-records a revision in place, and separates profiles', async () => {
    const io = fakeIo();
    const logs: string[] = [];
    const copies = fileReadCopies(io, 'default', (line) => void logs.push(line));
    for (let rev = 1; rev <= READ_COPY_REVS_PER_TAB + 1; rev += 1)
      await copies.record('d', 't', copy(rev));
    await copies.record('d', 't', copy(4, 'again'));
    expect(await copies.revisions('d', 't')).toEqual([2, 3, 4]);
    expect(await copies.at('d', 't', 4)).toEqual(copy(4, 'again'));
    expect(logs).toContain('copy evicted d/t rev 1');
    expect(await fileReadCopies(io, 'work', () => {}).revisions('d', 't')).toEqual([]);
  });

  it('evicts the least recently used copies past the byte budget, never the one just written', async () => {
    const io = fakeIo();
    const copies = fileReadCopies(io, 'default', () => {});
    const big = (rev: number) => copy(rev, 'x'.repeat(READ_COPY_MAX_BYTES / 2));
    await copies.record('d', 'a', big(1));
    await copies.record('d', 'b', big(1));
    await copies.record('d', 'c', big(1));
    expect(await copies.revisions('d', 'a')).toEqual([]);
    expect(await copies.revisions('d', 'c')).toEqual([1]);
    const huge = copy(1, 'x'.repeat(READ_COPY_MAX_BYTES));
    await copies.record('d', 'z', huge);
    expect(await copies.revisions('d', 'z')).toEqual([1]);
    expect(await copies.revisions('d', 'c')).toEqual([]);
  });

  it('starts over from an unreadable index, and misses a copy whose file is gone', async () => {
    const io = fakeIo();
    const copies = fileReadCopies(io, 'default', () => {});
    await copies.record('d', 't', copy(1));
    for (const [path] of io.fileMap) if (path.endsWith('/1.json')) io.fileMap.delete(path);
    expect(await copies.latest('d', 't')).toBeNull();
    io.fileMap.set(`${ROOT}/index.json`, { data: '{', mode: 0o600 });
    expect(await copies.revisions('d', 't')).toEqual([]);
    io.fileMap.set(`${ROOT}/index.json`, { data: '{"version":2}', mode: 0o600 });
    expect(await copies.revisions('d', 't')).toEqual([]);
  });
});
