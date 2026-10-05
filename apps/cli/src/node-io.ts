// The real CliIo: the process's streams and environment, the file system, global fetch and the clock.

import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import type { CliIo } from './io';

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
    files: {
      read: (path) => readFile(path, 'utf8').catch(() => null),
      write: async (path, data, mode) => {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        await writeFile(temporary, data, { mode: mode ?? 0o644 });
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
