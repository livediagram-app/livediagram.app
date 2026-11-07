import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every module here is its own subpath (`@liveworkspace/avatar/walk`), so an editor
// bundles only what it imports. A barrel would pull the whole package into whichever chunk touched
// it, so there is none, and every module has an entry of its own.
const here = fileURLToPath(new URL('.', import.meta.url));
const src = join(here, 'src');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')) as {
  exports: Record<string, string>;
};

const modules = (readdirSync(src, { recursive: true }) as string[])
  .map((path) => relative(src, join(src, path)).split(sep).join('/'))
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

describe('avatar exports', () => {
  it('has no barrel', () => {
    expect(modules.filter((path) => /(^|\/)index\.tsx?$/.test(path))).toEqual([]);
    expect(pkg.exports['.']).toBeUndefined();
  });

  it('gives every module its own subpath, named after its path', () => {
    const expected = Object.fromEntries(
      modules.sort().map((path) => [`./${path.replace(/\.tsx?$/, '')}`, `./src/${path}`]),
    );
    // A stylesheet is its own subpath too, named with its extension (an editor's globals.css imports it).
    const code = Object.fromEntries(
      Object.entries(pkg.exports).filter(([key]) => !key.endsWith('.css')),
    );
    expect(code).toEqual(expected);
  });

  it('gives every stylesheet its own subpath, extension and all', () => {
    const sheets = (readdirSync(src, { recursive: true }) as string[])
      .map((path) => relative(src, join(src, path)).split(sep).join('/'))
      .filter((path) => path.endsWith('.css'));
    expect(Object.fromEntries(sheets.map((path) => [`./${path}`, `./src/${path}`]))).toEqual(
      Object.fromEntries(Object.entries(pkg.exports).filter(([key]) => key.endsWith('.css'))),
    );
  });
});
