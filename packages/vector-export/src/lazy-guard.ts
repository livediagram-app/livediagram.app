// The guard that keeps the vector writers out of first load (liveworkspace/docs/specs/013-export/vector-pdf.md "Performance"): an app's tests
// list every source file that imports one of these modules statically, which a bundler would put in the importer's
// chunk; the writers must only ever be reached by a dynamic import(). Node only: read by tests, never by an app.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function sources(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'out') return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** `import ... from '<spec>'` and `export ... from '<spec>'`: the static forms a bundler puts in the importer's chunk
 *  (`import type` is erased, so it is left out). */
export function staticSpecifiers(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*(import|export)\b([^'";]*?)\bfrom\s*['"]([^'"]+)['"]/gm)) {
    if (/^\s*type\b/.test(m[2]!)) continue;
    out.push(m[3]!);
  }
  return out;
}

/** The writers' modules: fontkit and the PDF writer and outliner doors. */
export const LAZY_MODULES = [
  'fontkit',
  '@liveworkspace/vector-export/pdf',
  '@liveworkspace/vector-export/outline-svg',
];

/** Every source file under `appDir`'s `folders` that imports a lazy module statically, relative to `appDir`. */
export function staticLazyImports(
  appDir: string,
  folders: readonly string[],
): { files: number; offenders: string[] } {
  const files = folders.flatMap((d) => sources(join(appDir, d)));
  const offenders = files
    .filter((f) => staticSpecifiers(readFileSync(f, 'utf8')).some((s) => LAZY_MODULES.includes(s)))
    .map((f) => relative(appDir, f));
  return { files: files.length, offenders };
}
