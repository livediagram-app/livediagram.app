// The real CliIo: @liveworkspace/cli-kit's (the process's streams and environment, the file system, global fetch and
// the clock), and what the repository link needs besides: directory listings, moves and exclusive creates, watching
// a tree, and which processes are alive.

import { readdirSync, watch, type Dirent, type FSWatcher } from 'node:fs';
import { lstat, mkdir, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { nodeIo as kitNodeIo, toPosixPath } from '@liveworkspace/cli-kit/node-io';
import type { CliIo } from './io';

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

export function nodeIo(): CliIo {
  const io = kitNodeIo();
  return {
    ...io,
    watchTree,
    pid: process.pid,
    hostname: hostname(),
    processAlive,
    files: {
      ...io.files,
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
