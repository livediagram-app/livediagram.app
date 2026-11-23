import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkAriaLabelRoles, unnamedRoleTags } from './aria-label-roles';
import { checkClippedDescenders, clipsDescenders } from './clipped-descenders';
import { checkCommitUpdaterFlags, updaterFlags } from './commit-updater-flags';
import { bracketsACount, checkCountBadges } from './count-badges';
import { checkLabelContrast, lightSmallLabels } from './label-contrast';
import { sourceFiles } from './source-files';

// The source guards every editor runs over its own folders (its root *.test.ts files): each rule on a line or a
// source of its own, then over a small tree the way an editor hands one in.

let root: string | null = null;
function tree(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), 'source-guards-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

describe('sourceFiles', () => {
  it('walks folders for sources, leaving tests and other files out', () => {
    const dir = tree({
      'app/a.ts': '',
      'app/deep/b.tsx': '',
      'app/deep/b.test.tsx': '',
      'app/notes.md': '',
    });
    expect([...sourceFiles(dir)].map((f) => f.slice(dir.length + 1)).sort()).toEqual([
      'app/a.ts',
      'app/deep/b.tsx',
    ]);
    expect([...sourceFiles(dir, /\.tsx$/)]).toHaveLength(1);
  });
});

describe('counts are badges', () => {
  it('finds a count in brackets in a UI string, outside accessible labels', () => {
    expect(bracketsACount('const label = `Reveal (${items.length})`;')).toBe(true);
    expect(bracketsACount('const label = `Gallery (${count})`;')).toBe(true);
    expect(bracketsACount('const css = `brightness(${count})`;')).toBe(false);
    expect(bracketsACount('aria-label={`Reveal (${items.length})`}')).toBe(false);
  });

  it('names each offending line under the dirs it is handed', () => {
    const dir = tree({
      'app/a.ts': 'const ok = 1;\nconst bad = `Votes (${total})`;\n',
      'lib/b.test.ts': 'const bad = `Votes (${total})`;\n',
    });
    expect(checkCountBadges({ root: dir, dirs: ['app', 'lib'] })).toEqual([
      'app/a.ts:2: const bad = `Votes (${total})`;',
    ]);
  });
});

describe('small labels read at AA', () => {
  it('finds small or uppercase text paired with a light-mode text-slate-400', () => {
    expect(lightSmallLabels(`className="text-xs text-slate-400"`)).toBe(1);
    expect(lightSmallLabels(`cls('uppercase !text-slate-400', "text-xs text-slate-400")`)).toBe(2);
    expect(lightSmallLabels(`className="text-xs dark:text-slate-400 text-slate-500"`)).toBe(0);
    expect(lightSmallLabels(`className="text-lg text-slate-400"`)).toBe(0);
  });

  it('names each offending class string under the dirs it is handed', () => {
    const dir = tree({ 'components/a.tsx': '<p className="text-sm text-slate-400">x</p>\n' });
    expect(checkLabelContrast({ root: dir, dirs: ['components'] })).toEqual([
      'components/a.tsx:1: <p className="text-sm text-slate-400">x</p>',
    ]);
  });
});

describe('a name needs a role', () => {
  it('finds an aria-label on a role-less span, div or text tag', () => {
    expect(unnamedRoleTags('<div>\n  <span aria-label="Locked" />\n</div>')).toEqual([
      { line: 2, tag: 'span' },
    ]);
    expect(unnamedRoleTags('<span role="img" aria-label="Locked" />')).toEqual([]);
    expect(unnamedRoleTags('<div {...props} aria-label="Group" />')).toEqual([]);
    expect(unnamedRoleTags('<button aria-label="Close" />')).toEqual([]);
  });

  it('names each offending tag in the folders it is handed, by its path from the root', () => {
    const dir = tree({
      'components/a.tsx': '<div aria-label={label(a, { b })}>x</div>\n',
      'components/a.ts': '<div aria-label="not jsx">x</div>\n',
    });
    expect(checkAriaLabelRoles({ root: dir, dirs: [join(dir, 'components')] })).toEqual([
      '/components/a.tsx:1 <div>',
    ]);
  });
});

describe('clipped descenders', () => {
  it('reads a clipped line set leading-none as cutting its descenders', () => {
    expect(clipsDescenders('w-full truncate text-center text-[11px] leading-none')).toBe(true);
    expect(clipsDescenders('w-full truncate text-center text-[11px] leading-tight')).toBe(false);
    expect(clipsDescenders('text-[8px] font-semibold leading-none')).toBe(false);
  });

  it('names each offending className under the dirs it is handed', () => {
    const dir = tree({
      'components/a.tsx':
        '<p className="truncate">x</p>\n<p className="line-clamp-2 text-sm leading-none">y</p>\n',
    });
    expect(checkClippedDescenders({ root: dir, dirs: ['components'] })).toEqual([
      'components/a.tsx:2',
    ]);
  });
});

describe('a handler decides before it commits', () => {
  it('finds a flag written in an updater and read after it', () => {
    const bad = `const f = () => {\n  let done = false;\n  commit((els) => {\n    done = true;\n    return els;\n  });\n  if (done) track('x');\n};\n`;
    expect(updaterFlags(bad)).toEqual([{ line: 3, name: 'done' }]);
    const good = `const f = () => {\n  const done = check(els);\n  commit((els) => els);\n  if (done) track('x');\n};\n`;
    expect(updaterFlags(good)).toEqual([]);
    // Any setState-shaped setter, and a commit named in the middle.
    const setter = `const m = () => {\n  let settled = true;\n  setPos((prev) => {\n    settled = false;\n    return prev;\n  });\n  return settled;\n};\n`;
    expect(updaterFlags(setter)).toEqual([{ line: 3, name: 'settled' }]);
    expect(updaterFlags(setter.replace('setPos', 'rawCommitTabs'))).toHaveLength(1);
  });

  it('names each such variable under the dirs it is handed', () => {
    const bad = `const f = () => {\n  let done = false;\n  commit((els) => {\n    done = true;\n    return els;\n  });\n  if (done) track('x');\n};\n`;
    const dir = tree({ 'hooks/a.ts': bad, 'hooks/b.ts': 'export const fine = 1;\n' });
    expect(checkCommitUpdaterFlags({ root: dir, dirs: ['hooks'] })).toEqual(['hooks/a.ts:3: done']);
  });
});
