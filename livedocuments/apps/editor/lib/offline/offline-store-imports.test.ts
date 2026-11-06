// The Offline Mode store's imports never come back round to it (Work Tracker #576). It sits under the api modules (the
// unload save and the tab beacon reach it), so a path from it into lib/api closed a cycle: a test that mocked the
// store had to import the api module first, or the module saw the real store. And one inside lib/offline (the store,
// This Browser's list, the opens) left the store half-loaded while the opens read it. A static import that closes
// either again passes every other test; this one fails.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const STORE = join(root, 'lib/offline/offline-store.ts');

// Value imports and re-exports (a type-only one loads nothing).
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

// This app's modules only: `@/` and relative specifiers, as files.
function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith('@/')
    ? join(root, spec.slice(2))
    : spec.startsWith('.')
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

// Every module the store loads, each with the one that first imported it, and whether a path comes back to the store.
function walk() {
  const by = new Map<string, string | null>([[STORE, null]]);
  const queue = [STORE];
  let back: string | null = null;
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      const next = resolveLocal(file, spec);
      if (!next) continue;
      if (next === STORE) back ??= file;
      if (by.has(next)) continue;
      by.set(next, file);
      queue.push(next);
    }
  }
  const chain = (file: string) => {
    const out: string[] = [];
    for (let at: string | null = file; at; at = by.get(at) ?? null) out.unshift(relative(root, at));
    return out.join(' -> ');
  };
  return {
    reached: [...by.keys()].map((f) => relative(root, f)),
    back: back && chain(back),
    chain,
  };
}

describe('the Offline Mode store’s imports', () => {
  const graph = walk();

  it('never come back to the store', () => {
    expect(graph.back).toBeNull();
  });

  it('reach no api module but the error report, which imports none of this app', () => {
    const api = graph.reached.filter(
      (f) => f.startsWith('lib/api') && f !== 'lib/api/error-report.ts',
    );
    expect(api.map((f) => graph.chain(join(root, f)))).toEqual([]);
  });
});
