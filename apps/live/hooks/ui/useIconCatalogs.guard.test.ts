import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every useIconCatalogs() call uses what it returns (docs/specs/003-system-architecture/react-state-and-effects.md
// "The React Compiler": a forced re-render does not re-read module state). The editor builds with the React
// Compiler, which memoises a render-time `getIcon(iconId)` on its argument alone: a component that subscribed but
// read the catalogue without the subscription's value re-rendered when the chunk landed and kept the placeholder.
// A first visit's flowchart showed a framed question mark on every node until something else redrew it. Vitest runs
// without the compiler, so a render test passes either way; this guard holds the call sites instead.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  '.turbo',
  'coverage',
  'e2e',
]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('useIconCatalogs call sites', () => {
  it('each uses the value it returns, so the compiled render re-reads the catalogue when it lands', () => {
    const bare = sourceFiles(ROOT)
      .filter((file) => /^\s*useIconCatalogs\(\);/m.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(bare).toEqual([]);
  });

  it('finds the call sites it guards', () => {
    const callers = sourceFiles(ROOT).filter((file) =>
      /\buseIconCatalogs\(\)/.test(readFileSync(file, 'utf8')),
    );
    expect(callers.length).toBeGreaterThan(5);
  });
});
