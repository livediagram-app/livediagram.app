// The suites' fake host (docs/specs/015-api/blueprints/cli.md "Testing"): @liveworkspace/cli-kit's in-memory CliIo
// under this CLI's names, with what the repository link reaches besides (directory listings, moves, exclusive
// creates, symbolic links, a watched tree and live processes), and the capabilities a host with sign-in answers.

import {
  fakeIo as kitFakeIo,
  hostCapabilities,
  under,
  type FakeIo as KitFakeIo,
  type FakeIoOptions,
} from '@liveworkspace/cli-kit/testing/fake-io';
import type { CliIo } from '../io';
import { PRODUCT } from '../product';

export { NOW, TOKEN, type FakeSocket, type Route } from '@liveworkspace/cli-kit/testing/fake-io';

export type FakeIo = Omit<KitFakeIo, 'files'> &
  CliIo & {
    // Symbolic links: path to target.
    linkMap: Map<string, string>;
    // A change under a watched directory: each `watchTree` handler whose directory holds the path hears it.
    touch(path: string): void;
    // Processes this machine runs, for `processAlive`.
    alive: Set<number>;
  };

const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf('/'), 1));

export function fakeIo(options: FakeIoOptions & { links?: Record<string, string> } = {}): FakeIo {
  const io = kitFakeIo(PRODUCT, options);
  const { fileMap, dirMap } = io;
  const linkMap = new Map(Object.entries(options.links ?? {}));
  const watchers = new Set<{ dir: string; onChange: (path: string) => void }>();
  const alive = new Set<number>();
  return {
    ...io,
    watchTree: (dir, onChange) => {
      const watcher = { dir, onChange };
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    pid: 4242,
    hostname: 'test-host',
    processAlive: (pid) => alive.has(pid),
    files: {
      ...io.files,
      list: async (path) => {
        const children = new Map<string, 'file' | 'dir' | 'link'>();
        for (const p of [...fileMap.keys(), ...dirMap]) {
          if (!under(path, p)) continue;
          const rest = p.slice(path === '/' ? 1 : path.length + 1);
          const name = rest.split('/')[0]!;
          children.set(name, rest.includes('/') || dirMap.has(p) ? 'dir' : 'file');
        }
        for (const p of linkMap.keys())
          if (parentOf(p) === path) children.set(p.slice(path.length + 1), 'link');
        if (children.size === 0 && !dirMap.has(path)) return null;
        return [...children].map(([name, kind]) => ({ name, kind }));
      },
      move: async (from, to) => {
        const file = fileMap.get(from);
        if (!file) throw Object.assign(new Error(`ENOENT: ${from}`), { code: 'ENOENT' });
        fileMap.delete(from);
        fileMap.set(to, file);
      },
      createExclusive: async (path, data) => {
        if (fileMap.has(path)) return false;
        fileMap.set(path, { data, mode: 0o600 });
        return true;
      },
      realpath: async (path) => {
        for (const [link, target] of linkMap)
          if (path === link || under(link, path)) return `${target}${path.slice(link.length)}`;
        const exists =
          fileMap.has(path) ||
          dirMap.has(path) ||
          [...fileMap.keys(), ...dirMap].some((p) => under(path, p));
        return exists ? path : null;
      },
    },
    linkMap,
    touch: (path) => {
      for (const w of [...watchers]) if (under(w.dir, path)) w.onChange(path);
    },
    alive,
  };
}

// A host that has sign-in, at livehuddle.app.
export const capabilities = hostCapabilities({
  aiEnabled: false,
  apiBase: 'https://www.livehuddle.app/api',
  authEnabled: true,
  documentFormat: 2,
});
