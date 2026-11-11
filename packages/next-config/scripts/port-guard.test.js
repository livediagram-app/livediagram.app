import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  busyPortMessage,
  canBind,
  findListeners,
  guardPort,
  killHolders,
  parseLsofFields,
  run,
} from './port-guard.js';

// docs/specs/016-platform/nextjs.md (in each product) "Dev": next-dev.mjs refuses a port another process
// holds, names the holder and leaves it running; only --force kills it.

const NEXT_DEV = fileURLToPath(new URL('./next-dev.mjs', import.meta.url));
const hasLsof = run('sh', ['-c', 'command -v lsof']).trim() !== '';

/** A listener in a process of its own (another session's dev server, as far as the guard can tell). */
function startListener() {
  const child = spawn(
    process.execPath,
    [
      '-e',
      "const s = require('node:net').createServer(); s.listen(0, () => console.log(s.address().port));",
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  return new Promise((resolvePort, reject) => {
    child.once('error', reject);
    child.stdout.once('data', (chunk) =>
      resolvePort({ child, port: Number(String(chunk).trim()) }),
    );
  });
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

let listener;
afterEach(() => {
  listener?.child.kill('SIGKILL');
  listener = undefined;
});

describe('next-dev.mjs on a busy port', () => {
  it('exits with a message naming the holder and leaves it running', async () => {
    listener = await startListener();
    const result = spawnSync(process.execPath, [NEXT_DEV, '--port', String(listener.port)], {
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Port ${listener.port} is already in use`);
    expect(result.stderr).toContain('--force');
    if (hasLsof) expect(result.stderr).toContain(`PID ${listener.child.pid}`);
    expect(alive(listener.child.pid)).toBe(true);
  });

  it('prints its usage without a port', () => {
    const result = spawnSync(process.execPath, [NEXT_DEV], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage: next-dev.mjs --port <n> [--force]');
  });
});

describe('canBind and findListeners', () => {
  it('see a real listener and a free port', async () => {
    listener = await startListener();
    expect(await canBind(listener.port)).toBe(false);
    if (hasLsof) {
      expect(findListeners(listener.port)).toEqual([
        expect.objectContaining({
          pid: listener.child.pid,
          command: expect.stringMatching(/node/),
        }),
      ]);
    }
    const { port } = listener;
    listener.child.kill('SIGKILL');
    await new Promise((done) => listener.child.once('exit', done));
    listener = undefined;
    expect(await canBind(port)).toBe(true);
  });
});

describe('parseLsofFields', () => {
  it('reads one entry per process, keeping the first name', () => {
    expect(parseLsofFields('p12\ncnode\nf3\nn/one\nn/two\np34\ncnext-server\nx\n')).toEqual([
      { pid: 12, command: 'node', name: '/one' },
      { pid: 34, command: 'next-server', name: '' },
    ]);
  });

  it('ignores fields before a process and bad pids', () => {
    expect(parseLsofFields('cstray\nn/x\npnope\n')).toEqual([]);
    expect(parseLsofFields('')).toEqual([]);
  });
});

describe('run', () => {
  it('answers stdout, or empty when the command fails', () => {
    expect(run(process.execPath, ['-e', 'process.stdout.write("hi")'])).toBe('hi');
    expect(run(process.execPath, ['-e', 'process.exit(3)'])).toBe('');
  });
});

/** An lsof stand-in: the listener query answers `listening`, the cwd query `cwd`. */
const fakeExec = (listening, cwd = '') =>
  vi.fn((file, args) => {
    if (file !== 'lsof') return '';
    return args.includes('-sTCP:LISTEN') ? listening : cwd;
  });

describe('findListeners', () => {
  it('asks lsof for listeners only, then their folders', () => {
    const exec = fakeExec('p7\ncnode\np8\ncnext-server\n', 'p7\nfcwd\nn/work/a\n');
    expect(findListeners(3640, exec)).toEqual([
      { pid: 7, command: 'node', cwd: '/work/a' },
      { pid: 8, command: 'next-server', cwd: '' },
    ]);
    expect(exec).toHaveBeenCalledWith('lsof', ['-nP', '-iTCP:3640', '-sTCP:LISTEN', '-Fpc']);
    expect(exec).toHaveBeenCalledWith('lsof', ['-a', '-d', 'cwd', '-p', '7,8', '-Fpn']);
  });

  it('skips the folder query when nothing listens', () => {
    const exec = fakeExec('');
    expect(findListeners(3640, exec)).toEqual([]);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('busyPortMessage', () => {
  it('names each holder, its folder and the way out', () => {
    const message = busyPortMessage(3640, [
      { pid: 7, command: 'node', cwd: '/work/a' },
      { pid: 8, command: '', cwd: '' },
    ]);
    expect(message).toContain('Port 3640 is already in use');
    expect(message).toContain('Held by PID 7 (node) in /work/a');
    expect(message).toContain('Held by PID 8 (unknown)\n');
    expect(message).toContain('left running');
    expect(message).toContain('--force');
  });

  it('says so when no holder can be named', () => {
    expect(busyPortMessage(3640, [])).toContain('lsof cannot see');
  });
});

describe('killHolders', () => {
  it('kills children first, then the holder', () => {
    const exec = vi.fn(() => '');
    killHolders([{ pid: 7 }], exec);
    expect(exec.mock.calls).toEqual([
      ['pkill', ['-KILL', '-P', '7']],
      ['kill', ['-9', '7']],
    ]);
  });
});

describe('guardPort', () => {
  const holder = 'p7\ncnode\n';

  it('lets a free port through without killing anything', async () => {
    const exec = fakeExec('');
    expect(await guardPort(3640, { exec, bind: async () => true })).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('refuses a held port and kills nothing', async () => {
    const exec = fakeExec(holder);
    const result = await guardPort(3640, { exec, bind: async () => true });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Held by PID 7 (node)');
    expect(exec.mock.calls.some(([file]) => file === 'kill' || file === 'pkill')).toBe(false);
  });

  it('refuses a port it cannot bind even when lsof names no one, with or without --force', async () => {
    for (const force of [false, true]) {
      const result = await guardPort(3640, { force, exec: fakeExec(''), bind: async () => false });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('lsof cannot see');
    }
  });

  it('kills the holder only with --force, and says so', async () => {
    const exec = fakeExec(holder);
    const log = vi.fn();
    expect(await guardPort(3640, { force: true, exec, log })).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledWith('kill', ['-9', '7']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('--force: killed PID 7'));
  });
});
