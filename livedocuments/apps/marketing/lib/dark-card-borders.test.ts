import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// In dark, slate-800 (#16202e) is a surface one step off slate-900 (#131b26), not an edge
// (docs/specs/004-interface-design/color-scheme.md): a slate-900 card outlined in slate-800 showed no
// edge at all. A card's dark border is slate-700. The hero's editor mocks and the feature-card art are
// exempt: they draw the editor's own chrome as the editor draws it.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXEMPT = /(^|\/)(hero-[^/]*|feature-art\/.*)$/;

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

// A rounded, bordered slate-900 surface whose dark border is slate-800.
const FAINT_CARD =
  /(?=[^"'`]*\brounded)(?=[^"'`]*\bborder\b)[^"'`]*dark:border-slate-800\b[^"'`]*dark:bg-slate-900\b/;

describe('dark card borders', () => {
  const files = [...sources('app'), ...sources('components')].filter((f) => !EXEMPT.test(f));

  it('outlines every slate-900 card in slate-700, never the near-invisible slate-800', () => {
    expect(files.length).toBeGreaterThan(0);
    const faint = files.flatMap((f) =>
      readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        .flatMap((line, i) => (FAINT_CARD.test(line) ? [`${f}:${i + 1}`] : [])),
    );
    expect(faint).toEqual([]);
  });

  it('catches the faint pairing it guards against', () => {
    expect(
      FAINT_CARD.test(
        '"rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900"',
      ),
    ).toBe(true);
    expect(
      FAINT_CARD.test(
        '"rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"',
      ),
    ).toBe(false);
  });
});
