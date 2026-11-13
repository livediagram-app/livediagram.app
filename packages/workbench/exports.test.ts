import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every module here is its own subpath (`@liveworkspace/workbench/lib/listeners`), so an editor
// bundles only what it imports. A barrel would pull the whole package into whichever chunk touched
// it, so there is none, and every module has an entry of its own.
const here = fileURLToPath(new URL('.', import.meta.url));
const src = join(here, 'src');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')) as {
  exports: Record<string, string>;
};

const files = (readdirSync(src, { recursive: true }) as string[]).map((path) =>
  relative(src, join(src, path)).split(sep).join('/'),
);
const modules = files.filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));
// A stylesheet an editor imports (styles/image-backing.css) keeps its extension in its subpath.
const stylesheets = files.filter((path) => path.endsWith('.css'));

describe('workbench exports', () => {
  it('has no barrel', () => {
    expect(modules.filter((path) => /(^|\/)index\.tsx?$/.test(path))).toEqual([]);
    expect(pkg.exports['.']).toBeUndefined();
  });

  it('gives every module and stylesheet its own subpath, named after its path', () => {
    const expected = Object.fromEntries([
      ...modules.sort().map((path) => [`./${path.replace(/\.tsx?$/, '')}`, `./src/${path}`]),
      ...stylesheets.sort().map((path) => [`./${path}`, `./src/${path}`]),
    ]);
    expect(pkg.exports).toEqual(expected);
  });
});
