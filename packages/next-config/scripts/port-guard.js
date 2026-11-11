// The dev server's port guard: before `next dev` binds its port, find out whether another process already
// listens there, and if one does, say who and stop. Sessions and agents share one machine, so the process
// on the port is as likely another session's dev stack as a stray `next dev` of this one: a dev script never
// stops a process it did not start. `--force` is the explicit way to take the port anyway; it kills the
// listeners and their children, the way the script used to on every start.
//
// docs/specs/016-platform/nextjs.md (in each product) "Dev": a busy port is refused, not freed.

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';

/**
 * Runs a command and hands back its stdout, or '' when it fails (lsof exits 1 when nothing matches).
 * @param {string} file
 * @param {string[]} args
 */
export function run(file, args) {
  try {
    return execFileSync(file, args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
}

/**
 * Parses lsof's field output (`-F` with p, c and n fields) into one entry per process.
 * @param {string} output
 * @returns {{ pid: number, command: string, name: string }[]}
 */
export function parseLsofFields(output) {
  const processes = [];
  let current;
  for (const line of output.split('\n')) {
    const field = line[0];
    const value = line.slice(1);
    if (field === 'p') {
      current = { pid: Number(value), command: '', name: '' };
      processes.push(current);
    } else if (current && field === 'c') {
      current.command = value;
    } else if (current && field === 'n' && !current.name) {
      current.name = value;
    }
  }
  return processes.filter((entry) => Number.isInteger(entry.pid) && entry.pid > 0);
}

/**
 * The processes listening on a TCP port, with the folder each runs in, so the message can say whose they are.
 * Only listeners count: a browser tab connected to the port is a client, never its holder.
 * @param {number} port
 * @param {typeof run} [exec]
 * @returns {{ pid: number, command: string, cwd: string }[]}
 */
export function findListeners(port, exec = run) {
  const listeners = parseLsofFields(exec('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc']));
  if (listeners.length === 0) return [];
  const cwds = new Map(
    parseLsofFields(
      exec('lsof', ['-a', '-d', 'cwd', '-p', listeners.map((l) => l.pid).join(','), '-Fpn']),
    ).map((entry) => [entry.pid, entry.name]),
  );
  return listeners.map(({ pid, command }) => ({ pid, command, cwd: cwds.get(pid) ?? '' }));
}

/**
 * Whether this process can bind the port itself. It catches a listener lsof cannot see (another user's, or a
 * machine without lsof), so the guard never lets `next dev` start into an EADDRINUSE.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export function canBind(port) {
  return new Promise((resolveBind) => {
    const server = createServer();
    server.once('error', () => resolveBind(false));
    server.listen(port, () => server.close(() => resolveBind(true)));
  });
}

/**
 * The message a refused start prints: who holds the port and what to do about it.
 * @param {number} port
 * @param {{ pid: number, command: string, cwd: string }[]} holders
 */
export function busyPortMessage(port, holders) {
  const lines = [`[dev] Port ${port} is already in use, so this dev server did not start.`];
  if (holders.length === 0) {
    lines.push('[dev]   Held by a process lsof cannot see (another user, or lsof is missing).');
  }
  for (const { pid, command, cwd } of holders) {
    lines.push(`[dev]   Held by PID ${pid} (${command || 'unknown'})${cwd ? ` in ${cwd}` : ''}`);
  }
  lines.push(
    '[dev] It may be another session or agent on this machine, so it was left running.',
    '[dev] Stop it yourself if it is yours, pick another port, or pass --force to kill it and take the port.',
  );
  return lines.join('\n');
}

/**
 * Kills each holder and its children: `--force` alone. Children first, because lsof names only the processes
 * bound to the port, and a worker left alive keeps file handles open on the dev cache.
 * @param {{ pid: number }[]} holders
 * @param {typeof run} [exec]
 */
export function killHolders(holders, exec = run) {
  for (const { pid } of holders) {
    exec('pkill', ['-KILL', '-P', String(pid)]);
    exec('kill', ['-9', String(pid)]);
  }
}

/**
 * Checks the port before `next dev` starts. Answers `{ ok: true }` when the port is free (or was freed by
 * `--force`), else `{ ok: false, message }` naming who holds it.
 * @param {number} port
 * @param {{ force?: boolean, exec?: typeof run, bind?: typeof canBind, log?: (line: string) => void }} [options]
 */
export async function guardPort(
  port,
  { force = false, exec = run, bind = canBind, log = console.log } = {},
) {
  const holders = findListeners(port, exec);
  if (holders.length === 0 && (await bind(port))) return { ok: true };
  if (!force || holders.length === 0) return { ok: false, message: busyPortMessage(port, holders) };
  killHolders(holders, exec);
  log(
    `[dev] --force: killed PID ${holders.map((h) => h.pid).join(', ')} (and children) to take port ${port}`,
  );
  return { ok: true };
}
