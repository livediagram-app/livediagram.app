import { describe, expect, it } from 'vitest';
import { CliError } from '../output/cli-error';
import { fakeIo, NOW } from '../testing/fake-io';
import { SYNC_LOCK_POLL_MS, SYNC_LOCK_WAIT_MS } from './constants';
import { acquireLinkLock } from './lock';

// The lock (docs/specs/027-repositories/blueprints/repository-link.md "The lock"): one pass at a time per link.

const LOCK = '/state/lock';
const holder = (pid: number, hostname = 'test-host') =>
  JSON.stringify({ pid, hostname, startedAt: NOW, command: 'sync' });

describe('acquireLinkLock', () => {
  it('takes a free lock with its holder, and releases it', async () => {
    const logs: string[] = [];
    const io = fakeIo();
    const lock = await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      logs.push(l),
    );
    expect(JSON.parse(io.fileMap.get(LOCK)!.data)).toEqual({
      pid: 4242,
      hostname: 'test-host',
      startedAt: NOW,
      command: 'sync',
    });
    await lock.release();
    expect(io.fileMap.has(LOCK)).toBe(false);
    expect(logs).toEqual(['lock taken', 'lock released']);
  });

  it('takes over a lock whose holder on this machine is dead (RL34)', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) => logs.push(l));
    expect(JSON.parse(io.fileMap.get(LOCK)!.data).pid).toBe(4242);
    expect(logs).toEqual(['lock stale 77', 'lock taken']);
  });

  it('waits for a live holder, polling, and takes the lock once it goes', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    io.alive.add(77);
    let polls = 0;
    const sleep = io.sleep;
    io.sleep = async (ms) => {
      if (++polls === 3) io.fileMap.delete(LOCK);
      await sleep(ms);
    };
    await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) => logs.push(l));
    expect(io.slept).toEqual([SYNC_LOCK_POLL_MS, SYNC_LOCK_POLL_MS, SYNC_LOCK_POLL_MS]);
    expect(logs).toEqual(['lock-wait 77', 'lock taken']);
  });

  it('takes over from a holder that dies while this pass waits', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    io.alive.add(77);
    let polls = 0;
    const sleep = io.sleep;
    io.sleep = async (ms) => {
      if (++polls === 2) io.alive.delete(77);
      await sleep(ms);
    };
    await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) => logs.push(l));
    expect(JSON.parse(io.fileMap.get(LOCK)!.data).pid).toBe(4242);
    expect(io.slept).toEqual([SYNC_LOCK_POLL_MS, SYNC_LOCK_POLL_MS]);
    expect(logs).toEqual(['lock-wait 77', 'lock stale 77', 'lock taken']);
  });

  it('gives up after SYNC_LOCK_WAIT_MS naming the holder, and never judges another machine’s stale (E20)', async () => {
    const io = fakeIo({ files: { [LOCK]: holder(77, 'other-host') } });
    const failure = await acquireLinkLock(
      io,
      '/state',
      '/repo/livediagram.toml',
      'sync',
      () => {},
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toEqual({
      exit: 5,
      code: 'lock_held',
      message: 'another sync of /repo/livediagram.toml is running (process 77)',
      hint: 'wait for it, or stop process 77',
    });
    expect(io.slept.reduce((a, b) => a + b, 0)).toBe(SYNC_LOCK_WAIT_MS);
  });

  it('waits on a lock it cannot read, naming no process', async () => {
    const io = fakeIo({ files: { [LOCK]: '{' } });
    const failure = await acquireLinkLock(
      io,
      '/state',
      '/repo/livediagram.toml',
      'sync',
      () => {},
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toMatchObject({
      message: 'another sync of /repo/livediagram.toml is running (process ?)',
    });
  });
});

describe('a stale lock another pass takes first', () => {
  it('waits for that pass instead', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    const remove = io.files.remove;
    io.files.remove = async (path) => {
      await remove(path);
      if (path === LOCK && !io.alive.has(88)) {
        io.alive.add(88);
        io.fileMap.set(LOCK, { data: holder(88), mode: 0o600 });
      }
    };
    const failure = await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      logs.push(l),
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toMatchObject({ code: 'lock_held', hint: 'wait for it, or stop process 88' });
    expect(logs).toEqual(['lock stale 77', 'lock-wait 88']);
  });
});

describe('a lock that vanished or names no process', () => {
  it('waits naming no process', async () => {
    for (const data of [null, '{}']) {
      const io = fakeIo(data === null ? {} : { files: { [LOCK]: data } });
      io.files.createExclusive = async () => false;
      const failure = await acquireLinkLock(
        io,
        '/state',
        '/repo/livediagram.toml',
        'sync',
        () => {},
      ).catch((err: unknown) => (err as CliError).failure);
      expect(failure).toMatchObject({ hint: 'wait for it, or stop process ?' });
    }
  });
});
