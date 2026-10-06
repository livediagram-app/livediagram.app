// The real CliIo: the process's streams and environment, the file system, global fetch and the clock.

import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliIo, RoomSocket } from './io';

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

export function nodeIo(): CliIo {
  return {
    env: process.env,
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    readStdin,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    fetch: (request) => fetch(request),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    homedir: homedir(),
    cwd: process.cwd(),
    runtime: `node/${process.versions.node} ${process.platform}`,
    openSocket,
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
      remove: (path) => rm(path, { force: true }),
    },
  };
}
