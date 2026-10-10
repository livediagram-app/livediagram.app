// The real CliIo: the process's streams and environment, the file system, global fetch and the clock.

import { readdirSync, watch, type Dirent, type FSWatcher } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { createInterface, type Interface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { CliIo, LoopbackRequest, LoopbackServer, RoomSocket, ToolRun } from './io';

// The runtime's WebSocket (Node 22 and later), as the room stream uses it.
function openSocket(url: string): RoomSocket {
  const ws = new WebSocket(url);
  let closed = false;
  return {
    onOpen: (handler) => ws.addEventListener('open', () => handler()),
    onMessage: (handler) =>
      ws.addEventListener('message', (e) => {
        if (typeof e.data === 'string') handler(e.data);
      }),
    onClose: (handler) => {
      const once = (code: number) => {
        if (closed) return;
        closed = true;
        handler(code);
      };
      ws.addEventListener('close', (e) => once(e.code));
      ws.addEventListener('error', () => once(1006));
    },
    close: (code) => ws.close(code),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// One line interface for the process, made on the first prompt: stdin read a line at a time, the prompt on stderr.
// Ctrl-C on a terminal reaches readline, not the process: it is passed on as SIGINT, so `onInterrupt` hears it.
let lines: Interface | null = null;
function readLine(prompt: string): Promise<string | null> {
  lines ??= createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  const rl = lines;
  return new Promise((resolve) => {
    const onClose = () => {
      lines = null;
      resolve(null);
    };
    rl.once('close', onClose);
    rl.removeAllListeners('SIGINT');
    rl.on('SIGINT', () => {
      if (process.listenerCount('SIGINT') > 0) process.emit('SIGINT');
      else process.kill(process.pid, 'SIGINT');
    });
    rl.question(prompt, (answer) => {
      rl.off('close', onClose);
      resolve(answer);
    });
  });
}

// Change events under `dir`: one non-recursive watch per directory, added as directories appear. Node's recursive
// watch on Linux follows each file by its inode and goes quiet once a file is replaced by a rename, which is how
// editors, formatters and the CLI itself save; a directory's own watch hears every name in it. Symbolic links are
// never followed.
function watchTree(dir: string, onChange: (path: string) => void): () => void {
  const watchers = new Map<string, FSWatcher>();
  const add = (at: string) => {
    if (watchers.has(at)) return;
    let watcher: FSWatcher;
    try {
      watcher = watch(at, (event, name) => {
        if (!name) return;
        const path = join(at, name.toString());
        onChange(path);
        if (event === 'rename') void follow(path);
      });
    } catch {
      return;
    }
    watcher.on('error', () => drop(at));
    watchers.set(at, watcher);
    for (const entry of readdirSafe(at)) if (entry.isDirectory()) add(join(at, entry.name));
  };
  const drop = (at: string) => {
    for (const [path, watcher] of watchers)
      if (path === at || path.startsWith(`${at}/`)) {
        watcher.close();
        watchers.delete(path);
      }
  };
  // A name that came or went: a new directory is watched, a gone one dropped.
  const follow = async (path: string) => {
    const kind = await lstat(path).catch(() => null);
    if (kind?.isDirectory()) add(path);
    else if (!kind) drop(path);
  };
  add(dir);
  return () => drop(dir);
}

function readdirSafe(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

// The CLI walks paths with posix rules; Windows' own separators would never reach a root (`C:\x` has no `/`).
const toPosixPath = (path: string) =>
  process.platform === 'win32' ? path.replaceAll('\\', '/') : path;

export function nodeIo(): CliIo {
  return {
    env: process.env,
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    readStdin,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    readLine,
    watchTree,
    pid: process.pid,
    hostname: hostname(),
    processAlive,
    fetch: (request) => fetch(request),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    homedir: homedir(),
    cwd: toPosixPath(process.cwd()),
    runtime: `node/${process.versions.node} ${process.platform}`,
    openSocket,
    listenLoopback,
    openUrl,
    platform: process.platform,
    runTool,
    // Beside the bundle: dist/ holds livediagram.mjs, resvg.wasm and Inter-Regular.ttf.
    readAsset: async (name) =>
      new Uint8Array(await readFile(join(dirname(fileURLToPath(import.meta.url)), name))),
    timer: (ms, handler) => {
      const id = setTimeout(handler, ms);
      return () => clearTimeout(id);
    },
    // Ctrl-C, or a process manager stopping the command (PM2, systemd and containers send SIGTERM): heard once.
    onInterrupt: (handler) => {
      const once = () => {
        release();
        handler();
      };
      const release = () => {
        process.off('SIGINT', once);
        process.off('SIGTERM', once);
      };
      process.on('SIGINT', once);
      process.on('SIGTERM', once);
      return release;
    },
    files: {
      read: (path) => readFile(path, 'utf8').catch(() => null),
      write: async (path, data, mode) => {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        await writeFile(temporary, data, { mode: mode ?? 0o644 });
        await rename(temporary, path);
      },
      writeBytes: async (path, data) => {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        await writeFile(temporary, data);
        await rename(temporary, path);
      },
      mkdir: async (path, mode) =>
        void (await mkdir(path, { recursive: true, ...(mode ? { mode } : {}) })),
      mode: (path) =>
        stat(path).then(
          (s) => s.mode & 0o777,
          () => null,
        ),
      chmod: (path, mode) => chmod(path, mode),
      // A file, or an empty directory.
      remove: (path) =>
        rm(path, { force: true }).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== 'ERR_FS_EISDIR') throw err;
          return rmdir(path);
        }),
      list: async (path) => {
        try {
          const entries = await readdir(path, { withFileTypes: true });
          return entries.map((e) => ({
            name: e.name,
            kind: e.isSymbolicLink() ? 'link' : e.isDirectory() ? 'dir' : 'file',
          }));
        } catch {
          return null;
        }
      },
      move: async (from, to) => {
        await mkdir(dirname(to), { recursive: true });
        await rename(from, to);
      },
      createExclusive: async (path, data) => {
        await mkdir(dirname(path), { recursive: true });
        try {
          await writeFile(path, data, { flag: 'wx', mode: 0o600 });
          return true;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
          throw err;
        }
      },
      realpath: (path) => realpath(path).then(toPosixPath, () => null),
    },
  };
}

// One request at a time, in arrival order, until closed.
function listenLoopback(): Promise<LoopbackServer> {
  const waiting: ((request: LoopbackRequest) => void)[] = [];
  const queued: LoopbackRequest[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const request: LoopbackRequest = {
      path: url.pathname,
      query: url.searchParams,
      respond: (status, html) => {
        res.writeHead(status, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(html);
      },
    };
    const take = waiting.shift();
    if (take) take(request);
    else queued.push(request);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : 0,
        next: () => {
          const ready = queued.shift();
          return ready ? Promise.resolve(ready) : new Promise((r) => waiting.push(r));
        },
        // A browser keeps a preconnected or keep-alive socket open after the callback; end those too, or the
        // process stays alive until the person closes the tab.
        close: () => {
          server.close();
          server.closeAllConnections();
        },
      });
    });
  });
}

// The platform's opener (CLI34): `open`, `xdg-open`, or `rundll32 url.dll,FileProtocolHandler`. Never a shell: on
// Windows `cmd /c start` would read the URL's `&` as a command separator (a broken sign-in, and an injection), so the
// URL goes to rundll32 as one argument. Only an http(s) URL is opened at all.
export function openerFor(
  platform: NodeJS.Platform,
  url: string,
): [command: string, args: string[]] | null {
  if (!/^https?:\/\//i.test(url)) return null;
  if (platform === 'darwin') return ['open', [url]];
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]];
  return ['xdg-open', [url]];
}

// Detached, its output ignored.
function openUrl(url: string): Promise<boolean> {
  const opener = openerFor(process.platform, url);
  if (!opener) return Promise.resolve(false);
  const [command, args] = opener;
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

// A system tool, no shell: its arguments are passed as they are, and the input travels on stdin.
function runTool(command: string, args: readonly string[], input: string): Promise<ToolRun | null> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: ['pipe', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.once('error', () => resolve(null));
    child.once('close', (code) => resolve({ code: code ?? 1, stdout }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
