import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// One switch (docs/specs/004-interface-design/design-principles.md, "One switch"): every on/off switch in every app
// is drawn by src/Switch.tsx (Switch, SwitchRow, SwitchChip), so it is the only source that may write
// `role="switch"`. A second hand-drawn switch drifts in size, colour, focus ring and keyboard; reach for the shared
// one (`size="sm"` for a dense row, `presentational` for a row that keeps its own semantics) instead.

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = new Set([join('packages', 'ui', 'src', 'Switch.tsx')]);
// Every workspace that ships UI: the shared packages and each product's apps and packages.
const ROOTS = [
  'packages',
  'liveworkspace/apps',
  ...['livediagram', 'liveplanner', 'livedocuments', 'livedesign'].flatMap((p) => [
    `${p}/apps`,
    `${p}/packages`,
  ]),
];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  '.next-analyze',
  '.open-next',
  '.wrangler',
  'out',
  'coverage',
  'e2e',
  '.turbo',
  'dist',
]);
// The role as an attribute or a prop (`role="switch"`, `role={'switch'}`, `role: 'switch'`), never a CSS selector
// such as `[role="switch"]` naming the role to find it, nor prose quoting it in backticks.
const ROLE_SWITCH = /(?<![[\w`-])role\s*(=\s*\{?\s*|:\s*)["'`]switch["'`]/;

function sources(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const path = join(dir, name);
    let isDir: boolean;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      return [];
    }
    if (isDir) return SKIP_DIRS.has(name) ? [] : sources(path);
    if (!/\.(tsx|ts|jsx|js)$/.test(name) || /\.(test|spec)\.[jt]sx?$/.test(name)) return [];
    if (name.endsWith('.d.ts')) return [];
    return [path];
  });
}

function strayRoleSwitches(): string[] {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for (const file of sources(join(REPO, root))) {
      const rel = relative(REPO, file);
      if (ALLOWED.has(rel)) continue;
      const text = readFileSync(file, 'utf8');
      if (!text.includes('switch')) continue;
      text.split('\n').forEach((line, i) => {
        if (ROLE_SWITCH.test(line))
          hits.push(`${rel.split(sep).join('/')}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  return hits;
}

describe('one switch', () => {
  it('writes role="switch" only in packages/ui/src/Switch.tsx', () => {
    expect(strayRoleSwitches()).toEqual([]);
  });

  it('spots the role however it is written, but not a selector naming it', () => {
    for (const line of [
      '<button role="switch"',
      "  role={'switch'}",
      "const props = { role: 'switch' }",
    ])
      expect(ROLE_SWITCH.test(line), line).toBe(true);
    for (const line of [
      '\'[role="switch"]\',',
      'querySelector(\'[role="switch"]\')',
      'data-role="switch"',
      '// a `role="switch"` button',
    ])
      expect(ROLE_SWITCH.test(line), line).toBe(false);
  });
});
