// The one colour picker (docs/specs/004-interface-design/colour-picker.md "The rule for new work"):
// every colour choice goes through components/colour. This guards the two ways a feature most
// easily grows its own picker again: a system colour well, or the custom colour editor mounted
// somewhere of its own.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const LIVE = join(__dirname, '..', '..');
const ROOTS = ['app', 'components', 'hooks', 'lib'].map((d) => join(LIVE, d));
// The picker itself, and Quick Style's custom swatch popover, which holds the same editor by spec
// (colour-picker.md "Picking a colour of your own").
const EDITOR_ALLOWED = ['components/colour/', 'components/canvas/SwatchOverridePopover.tsx'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = ROOTS.flatMap(sources).map((path) => ({
  path: relative(LIVE, path),
  text: readFileSync(path, 'utf8'),
}));

describe('the one colour picker', () => {
  it('has no system colour well anywhere', () => {
    const wells = files.filter((f) =>
      /type=\{?["']color["']\}?|type:\s*["']color["']/.test(f.text),
    );
    expect(wells.map((f) => f.path)).toEqual([]);
  });

  it('mounts the custom colour editor only inside the picker', () => {
    const outside = files.filter(
      (f) =>
        /\bCustomColourEditor\b/.test(f.text) &&
        !EDITOR_ALLOWED.some((allowed) => f.path.startsWith(allowed)),
    );
    expect(outside.map((f) => f.path)).toEqual([]);
  });
});
