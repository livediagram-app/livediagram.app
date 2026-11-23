import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { filesUnder } from './source-files';

// Every next/dynamic import in an app must carry its own Suspense boundary.
//
// In the App Router, `dynamic()` only wraps the lazy component in a <Suspense> when
// `ssr: false` or a `loading` component is given (next/dist/shared/lib/lazy-dynamic/loadable.js:
// `hasSuspenseBoundary = !opts.ssr || !!opts.loading`, and ssr defaults to true). Without one, the
// first mount of the lazy piece suspends up to the NEAREST ancestor boundary and replaces everything
// under it until the chunk lands.
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  '.turbo',
  'coverage',
  'e2e',
]);
const isSource = (name: string) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);

/** The full text of each `dynamic(...)` call in a source, balanced on parentheses. */
export function dynamicCalls(src: string): string[] {
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

/** Every next/dynamic call under `dirs` (absolute folders) with no boundary of its own, as `path: first line`. */
export function checkDynamicBoundaries({
  root,
  dirs,
}: {
  root: string;
  dirs: readonly string[];
}): string[] {
  const offenders: string[] = [];
  for (const file of dirs.flatMap((dir) => filesUnder(dir, SKIP_DIRS, isSource))) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes("from 'next/dynamic'")) continue;
    for (const call of dynamicCalls(src)) {
      if (!/ssr:\s*false|loading:/.test(call)) {
        offenders.push(`${relative(root, file)}: ${call.split('\n')[0]}`);
      }
    }
  }
  return offenders;
}
