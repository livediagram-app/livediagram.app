import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every next/dynamic import in the app must carry its own Suspense boundary.
//
// In the App Router, `dynamic()` only wraps the lazy component in a <Suspense> when
// `ssr: false` or a `loading` component is given (next/dist/shared/lib/lazy-dynamic/loadable.js:
// `hasSuspenseBoundary = !opts.ssr || !!opts.loading`, and ssr defaults to true). Without one, the
// first mount of the lazy piece suspends up to the NEAREST ancestor boundary and replaces everything
// under it until the chunk lands. For a document opened in place from /new that ancestor is the editor's
// own `dynamic(loadEditor, { loading: <DocumentLoading /> })`, so the first open of Settings or Search
// flashed the opening screen over the whole editor; in the Explorer, a pane swapped the whole layout
// for its null fallback. Every lazy piece here is client-state-gated in a static export, so
// `ssr: false` (a boundary with a null fallback) costs nothing.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
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

// The full text of each `dynamic(...)` call, balanced on parentheses.
function dynamicCalls(src: string): string[] {
  const calls: string[] = [];
  for (const m of src.matchAll(/\bdynamic\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (depth > 0 && i < src.length) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
      i += 1;
    }
    calls.push(src.slice(m.index, i));
  }
  return calls;
}

describe('next/dynamic imports', () => {
  it('each carry their own Suspense boundary (ssr: false or a loading component)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes("from 'next/dynamic'")) continue;
      for (const call of dynamicCalls(src)) {
        if (!/ssr:\s*false|loading:/.test(call)) {
          offenders.push(`${relative(ROOT, file)}: ${call.split('\n')[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
