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
      if (path.startsWith(`${LOCK}.stale`) && !io.alive.has(88)) {
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

// Two passes waiting on the same dead holder (RL34): the slower one used to remove, by name, the lock the faster had
// just taken over, and both ran. The stale lock is now renamed aside and checked before anything is created.
describe('two passes taking over the same stale lock', () => {
  it('lets one take it; the other puts the lock back and waits', async () => {
    const first = fakeIo({ files: { [LOCK]: holder(77) } });
    first.alive.add(5555);
    first.alive.add(4242);
    let firstDone: Promise<unknown> = Promise.resolve();
    // The second pass judges 77 dead, then stalls until the first has taken the lock over.
    const stall = async () => void (await firstDone);
    const second = {
      ...first,
      pid: 5555,
      files: {
        ...first.files,
        remove: async (path: string) => {
          if (path === LOCK) await stall();
          return first.files.remove(path);
        },
        move: async (from: string, to: string) => {
          if (from === LOCK) await stall();
          return first.files.move(from, to);
        },
      },
    };
    const secondLogs: string[] = [];
    const secondRun = acquireLinkLock(second, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      secondLogs.push(l),
    ).catch((err: unknown) => (err as CliError).failure);
    firstDone = acquireLinkLock(first, '/state', '/repo/livediagram.toml', 'sync', () => {});
    await firstDone;
    expect(await secondRun).toMatchObject({
      code: 'lock_held',
      hint: 'wait for it, or stop process 4242',
    });
    expect(JSON.parse(first.fileMap.get(LOCK)!.data).pid).toBe(4242);
    expect([...first.fileMap.keys()].filter((k) => k.startsWith(LOCK))).toEqual([LOCK]);
    expect(secondLogs.slice(0, 2)).toEqual(['lock stale 77', 'lock stale already taken']);
  });
});

// The rename aside losing a race (blueprint "The lock"): whatever another pass did with the stale lock, this pass
// never deletes a live holder's lock, and waits naming whoever holds it now.
describe('a stale lock another pass moves first', () => {
  it('waits for the pass that moved it and took the lock', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    const move = io.files.move;
    io.files.move = async (from, to) => {
      if (from === LOCK && !io.alive.has(88)) {
        // Process 88 renamed 77's lock aside and took the lock over just before this rename.
        io.alive.add(88);
        io.fileMap.set(LOCK, { data: holder(88), mode: 0o600 });
        throw Object.assign(new Error(`ENOENT: ${from}`), { code: 'ENOENT' });
      }
      return move(from, to);
    };
    const failure = await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      logs.push(l),
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toMatchObject({ code: 'lock_held', hint: 'wait for it, or stop process 88' });
    expect(JSON.parse(io.fileMap.get(LOCK)!.data).pid).toBe(88);
    expect(logs.slice(0, 2)).toEqual(['lock stale 77', 'lock-wait 88']);
  });
});

describe('a taken-over lock that cannot be put back', () => {
  it('logs the lost restore and waits on the pass now holding the lock', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    const move = io.files.move;
    io.files.move = async (from, to) => {
      if (from === LOCK && !io.alive.has(88)) {
        // Process 88 took the stale lock over between this pass's read and its rename.
        io.alive.add(88);
        io.alive.add(99);
        io.fileMap.set(LOCK, { data: holder(88), mode: 0o600 });
        await move(from, to);
        // And process 99 created a fresh lock before 88's could go back.
        io.fileMap.set(LOCK, { data: holder(99), mode: 0o600 });
        return;
      }
      return move(from, to);
    };
    const failure = await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      logs.push(l),
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toMatchObject({ code: 'lock_held', hint: 'wait for it, or stop process 99' });
    expect(logs.slice(0, 4)).toEqual([
      'lock stale 77',
      'lock stale already taken',
      'lock restore lost',
      'lock-wait 88',
    ]);
    expect([...io.fileMap.keys()].filter((k) => k.startsWith(LOCK))).toEqual([LOCK]);
  });

  it('puts nothing back when the moved lock vanished, and keeps waiting', async () => {
    const logs: string[] = [];
    const io = fakeIo({ files: { [LOCK]: holder(77) } });
    const move = io.files.move;
    let vanished = false;
    io.files.move = async (from, to) => {
      await move(from, to);
      if (from === LOCK && !vanished) {
        // The file renamed aside is gone before it is read back (another pass cleaned it up).
        vanished = true;
        io.fileMap.delete(to);
      }
    };
    const create = io.files.createExclusive;
    io.files.createExclusive = async (path, data) => {
      // Another pass holds the lock from here on: every create fails.
      return vanished ? false : create(path, data);
    };
    const failure = await acquireLinkLock(io, '/state', '/repo/livediagram.toml', 'sync', (l) =>
      logs.push(l),
    ).catch((err: unknown) => (err as CliError).failure);
    expect(failure).toMatchObject({ code: 'lock_held', hint: 'wait for it, or stop process ?' });
    expect(logs.slice(0, 3)).toEqual(['lock stale 77', 'lock stale already taken', 'lock-wait ?']);
  });
});
