// The real CliIo: the process's streams and environment, the file system, global fetch and the clock.

import { watch } from 'node:fs';
import {
  chmod,
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

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export function nodeIo(): CliIo {
  return {
    env: process.env,
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    readStdin,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    readLine,
    watchTree: (dir, onChange) => {
      const watcher = watch(dir, { recursive: true }, (_event, name) => {
        if (name) onChange(join(dir, name.toString()));
      });
      return () => watcher.close();
    },
    pid: process.pid,
    hostname: hostname(),
    processAlive,
    fetch: (request) => fetch(request),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    homedir: homedir(),
    cwd: process.cwd(),
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
    onInterrupt: (handler) => {
      process.once('SIGINT', handler);
      return () => void process.off('SIGINT', handler);
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
      realpath: (path) => realpath(path).catch(() => null),
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
        close: () => server.close(),
      });
    });
  });
}

// The platform's opener (CLI34): `open`, `xdg-open`, or `cmd /c start ""`. Detached, its output ignored.
function openUrl(url: string): Promise<boolean> {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
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
