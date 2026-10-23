// What every route of the editor app loads up front (docs/specs/016-platform/web-performance.md).
// The root not-found slot and the root layout's providers ship with EVERY route, sign-in and the
// Explorer included, so a static import from either lands in all of their first loads. A static
// import of the editor from not-found.tsx once put about 1,150 KiB gzipped on every page; these
// keep the heavy pieces behind a dynamic import.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('every route’s first load', () => {
  it('loads the editor from the not-found slot only when the slot renders', () => {
    const src = read('app/not-found.tsx');
    expect(staticImports(src).some((p) => p.includes('editor-page'))).toBe(false);
    expect(src).toContain("import('./design/[id]/editor-page')");
  });
});

describe('the Explorer’s first load', () => {
  it('loads Settings and the move picker on first open', () => {
    const imports = staticImports(read('app/explorer/ExplorerShell.tsx'));
    expect(imports).not.toContain('@/components/dialogs/SettingsDialog');
    expect(imports).not.toContain('@/components/dialogs/MoveToFolderDialog');
  });
});
