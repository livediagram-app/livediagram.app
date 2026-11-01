import { describe, expect, it } from 'vitest';
import { testStore } from '../test-support';
import { newJob } from './steps';
import { BUFFER_PIECE_BYTES, JobStore, objectKey, viewOf } from './store';

const call = {
  key: 'team:t1',
  requestedBy: 'user_ada',
  scope: { kind: 'team' as const, teamId: 't1', teamName: 'Design' },
};

describe('JobStore', () => {
  it('keeps the tail across pieces, as bytes', () => {
    const { store } = testStore();
    const tail = new Uint8Array(BUFFER_PIECE_BYTES * 2 + 5).map((_, i) => i % 251);
    store.saveTail(tail);
    expect(Buffer.from(store.tail()).equals(Buffer.from(tail))).toBe(true);
    store.saveTail(new Uint8Array());
    expect(store.tail().length).toBe(0);
  });

  it('reads a blob that comes back as an ArrayBuffer, as on Workers', () => {
    const rows = [{ bytes: new Uint8Array([1, 2]).buffer }];
    const store = new JobStore({
      exec: (q: string) => ({ toArray: () => (q.startsWith('SELECT bytes') ? rows : []) }),
    });
    expect([...store.tail()]).toEqual([1, 2]);
  });

  it('keeps a personal job’s profile', () => {
    const { store } = testStore();
    store.begin(
      newJob(
        {
          ...call,
          key: 'personal:user_ada',
          scope: { kind: 'personal', personId: 'user_ada' },
          profile: { name: 'Ada' },
        },
        'ex_1',
        10,
      ),
    );
    expect(store.job()!.profile).toEqual({ name: 'Ada' });
    store.begin({ ...store.job()!, notifyPending: true });
    expect(store.job()!.notifyPending).toBe(true);
  });

  it('answers no job, then a team job without a profile', () => {
    const { store } = testStore();
    expect(store.job()).toBeNull();
    store.begin(newJob(call, 'ex_1', 10));
    const job = store.job()!;
    expect(job).toMatchObject({
      id: 'ex_1',
      profile: null,
      finishedAt: null,
      expiresAt: null,
      phase: 'listing',
    });
    expect(store.remaining('item')).toBe(0);
    expect(store.entryStats()).toEqual({ count: 0, nameBytes: 0 });
    store.forget();
    expect(store.job()).toBeNull();
  });

  it('records queue rows, entries, parts, comments and problems, and clears them', () => {
    const { store } = testStore();
    store.begin(newJob(call, 'ex_1', 10));
    store.enqueue([
      { kind: 'image', app: null, ref: 'i', name: 'n', updatedAt: 1, contentType: null },
    ]);
    expect(store.next('image')).toMatchObject({ app: null, contentType: null });
    store.addEntries([
      { name: 'ü.txt', method: 0, crc: 1, compressedSize: 2, size: 2, offset: 0, time: 0, date: 0 },
    ]);
    expect(store.entryStats()).toEqual({ count: 1, nameBytes: 6 });
    store.addParts([{ partNumber: 1, etag: 'a' }]);
    store.addParts([{ partNumber: 1, etag: 'b' }]);
    expect(store.parts()).toEqual([{ partNumber: 1, etag: 'b' }]);
    store.addProblems([{ app: 'livediagram', name: 'A', reason: 'r' }]);
    expect(store.problems()).toHaveLength(1);
    store.clearWork();
    expect(store.parts()).toEqual([]);
    expect(store.entries()).toEqual([]);
  });

  it('shows a phase only while running, and names the zip by key and id', () => {
    const job = { ...newJob(call, 'ex_1', 10), status: 'ready' as const, phase: 'items' as const };
    expect(viewOf(job).phase).toBeNull();
    expect(viewOf({ ...job, status: 'running' }).phase).toBe('items');
    expect(objectKey('team:t1', 'ex_1')).toBe('exports/team:t1/ex_1.zip');
  });
});
