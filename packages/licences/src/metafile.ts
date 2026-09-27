import { posix } from 'node:path';

import { LicencesError } from './errors.ts';

function fail(why: string): never {
  throw new LicencesError('MetafileFormatUnrecognised', why);
}

// A virtual module (`cloudflare:workers`, `<runtime>`) lives in no file.
const VIRTUAL_INPUT = /^(<|[a-z][a-z-]*:)/i;

// Decodes a wrangler (esbuild) metafile into the repo-relative paths of every
// module bundled into the worker. `appDir` is the worker's repo-relative
// directory, which esbuild's input keys are relative to.
export function decodeMetafile(meta: unknown, appDir: string): string[] {
  if (typeof meta !== 'object' || meta === null) fail('not an object');
  const inputs = (meta as { inputs?: unknown }).inputs;
  if (typeof inputs !== 'object' || inputs === null || Array.isArray(inputs)) {
    fail('"inputs" is not an object');
  }
  const paths = new Set<string>();
  for (const key of Object.keys(inputs)) {
    if (VIRTUAL_INPUT.test(key)) continue;
    const rel = posix.normalize(posix.join(appDir, key));
    if (rel.startsWith('../')) fail(`input ${key} is outside the repository`);
    paths.add(rel);
  }
  return [...paths].sort();
}
