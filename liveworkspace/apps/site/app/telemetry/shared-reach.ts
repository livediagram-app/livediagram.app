// Test support for platform-emitters.ts: which of the shared packages' files an app actually uses.
//
// A shared package's emit is an app's own only when the app's code reaches the file it sits in: the
// shared editor's spotlight sliders (`@liveworkspace/workbench/hooks/canvas/useSpotlightConfig`) are
// livediagram's, livedesign's and livedocuments' events, never liveplanner's, which mounts no
// spotlight. Reach follows import specifiers (`from '…'`, `import '…'`, `import('…')`) from every file
// in the app's tree, through each `@liveworkspace/*` package's export map and relative imports, across
// every shared package (one the app imports may import another). A specifier written in a comment
// counts too, which errs towards counting an emit, the scan's old behaviour, never away from it.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { sourceFiles, type ScanTree } from './emitter-scan';

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

type Exports = Record<string, string | Record<string, string>>;

// A package's export target for a subpath (`.`, `./hooks/x`), through a `*` wildcard (each `*` in the target
// takes the match, as Node's export maps do).
export function exportTarget(exports: Exports, subpath: string): string | undefined {
  const pick = (v: Exports[string] | undefined) =>
    typeof v === 'string' ? v : (v?.import ?? v?.default);
  const exact = pick(exports[subpath]);
  if (exact) return exact;
  for (const [key, value] of Object.entries(exports)) {
    const star = key.indexOf('*');
    if (star < 0) continue;
    const head = key.slice(0, star);
    const tail = key.slice(star + 1);
    if (!subpath.startsWith(head) || !subpath.endsWith(tail)) continue;
    const target = pick(value);
    if (target)
      return target.replaceAll('*', subpath.slice(head.length, subpath.length - tail.length));
  }
  return undefined;
}

function resolveFile(base: string): string | undefined {
  for (const ext of EXTENSIONS) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return undefined;
}

// Every file under `monorepo`'s shared packages (`packages/*`) that `app` reaches, monorepo-relative.
export function reachedSharedFiles(monorepo: string, app: ScanTree): Set<string> {
  const exportsCache = new Map<string, Exports | null>();
  const packageExports = (pkg: string): Exports | null => {
    if (!exportsCache.has(pkg)) {
      const json = join(monorepo, 'packages', pkg, 'package.json');
      const manifest = existsSync(json)
        ? (JSON.parse(readFileSync(json, 'utf8')) as { exports?: Exports })
        : undefined;
      exportsCache.set(pkg, manifest?.exports ?? null);
    }
    return exportsCache.get(pkg)!;
  };
  const resolveSpecifier = (from: string, spec: string): string | undefined => {
    if (spec.startsWith('.')) return resolveFile(join(dirname(from), spec));
    const m = /^@liveworkspace\/([^/]+)(\/.*)?$/.exec(spec);
    const pkg = m?.[1];
    if (!pkg) return undefined;
    const exports = packageExports(pkg);
    const target = exports && exportTarget(exports, m[2] ? `.${m[2]}` : '.');
    return target ? resolveFile(join(monorepo, 'packages', pkg, target)) : undefined;
  };

  const shared = join(monorepo, 'packages') + '/';
  const reached = new Set<string>();
  const queue: string[] = [];
  const follow = (file: string) => {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const target = spec && resolveSpecifier(file, spec);
      // Only shared files are walked: an app's own relative imports are already in its tree.
      if (target?.startsWith(shared) && !reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  };
  for (const dir of app.roots) {
    for (const file of sourceFiles(join(app.root, dir), app.skip)) follow(file);
  }
  while (queue.length) follow(queue.pop()!);
  return new Set([...reached].map((file) => relative(monorepo, file)));
}
