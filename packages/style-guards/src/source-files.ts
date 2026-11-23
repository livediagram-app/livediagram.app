import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Where a source guard looks: `dirs` are relative to `root` (an app's folder), and may reach outside it. */
export type SourceGuardOptions = { root: string; dirs: readonly string[] };

/** Every source file under `dir` whose name matches `pattern`, tests left out. */
export function* sourceFiles(dir: string, pattern: RegExp = /\.tsx?$/): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path, pattern);
    else if (pattern.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

/** Each matching file under the guard's dirs, with its path from `root` and its text. */
export function* guardedSources(
  { root, dirs }: SourceGuardOptions,
  pattern?: RegExp,
): Generator<{ rel: string; text: string }> {
  for (const dir of dirs)
    for (const file of sourceFiles(join(root, dir), pattern))
      yield { rel: relative(root, file), text: readFileSync(file, 'utf8') };
}

/** Every file under `dir` that `keep` takes by name, never entering a folder named in `skip`. */
export function filesUnder(
  dir: string,
  skip: ReadonlySet<string>,
  keep: (name: string) => boolean,
  acc: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, skip, keep, acc);
    else if (keep(entry)) acc.push(full);
  }
  return acc;
}
