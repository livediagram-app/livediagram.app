// The Arcade Machine's game is never part of a Space's first load (docs/specs/009-elements/social-pieces.md "The
// panel"; blueprint "Arcade performance and limits"): Moon Mail's model, its painter and the panel load with lazy()
// the first time a machine opens. This walks every static import from the editor's entries through this app's own
// files (a dynamic import() is where a chunk splits, so it is not followed) and fails when one reaches the game.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const ENTRIES = ['app/layout.tsx', 'app/not-found.tsx', 'app/document/[id]/editor-page.tsx'];
const GAME = [
  'lib/arcade/moon-mail.ts',
  'lib/arcade/moon-mail-paint.ts',
  'lib/arcade/arcade-post.ts',
  'components/canvas/collab/arcade/ArcadePanel.tsx',
  'components/canvas/collab/arcade/useMoonMail.ts',
  'components/canvas/collab/arcade/MoonMailScreen.tsx',
  'components/canvas/collab/arcade/HighScores.tsx',
];

// `import x from '…'`, `import { a, type B } from '…'`, `export { a } from '…'`, `export * from '…'` and a bare
// `import '…'`; never `import type` or `export type`, which leave nothing in a chunk.
const STATIC = /^\s*(?:import|export)\s+(?!type\b)(?:[^;'"]*?\sfrom\s+)?'([^']+)'/gms;

function resolveFile(base: string): string | null {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveImport(from: string, spec: string): string | null {
  if (spec.startsWith('@/')) return resolveFile(join(ROOT, spec.slice(2)));
  if (spec.startsWith('.')) return resolveFile(join(dirname(from), spec));
  return null;
}

/** Every file of this app a static import chain from `entries` reaches. */
function staticallyReached(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.map((e) => join(ROOT, e));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(STATIC)) {
      const next = resolveImport(file, m[1]!);
      if (next && /\.tsx?$/.test(next) && !seen.has(next)) queue.push(next);
    }
  }
  return new Set([...seen].map((f) => relative(ROOT, f)));
}

describe('a Space’s first load', () => {
  const reached = staticallyReached(ENTRIES);

  it('reaches the canvas and the arcade’s face (the walk is real)', () => {
    expect(reached.has('components/canvas/Canvas.tsx')).toBe(true);
    expect(reached.has('components/canvas/collab/ArcadeFace.tsx')).toBe(true);
  });

  it.each(GAME)('holds none of the game: %s', (file) => {
    expect(existsSync(join(ROOT, file))).toBe(true);
    expect(reached.has(file)).toBe(false);
  });

  it('loads the panel with a dynamic import from the face', () => {
    const face = readFileSync(join(ROOT, 'components/canvas/collab/ArcadeFace.tsx'), 'utf8');
    expect(face).toContain("lazy(() => import('./arcade/ArcadePanel'))");
  });
});
