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
    expect(src).toContain("import('./document/[id]/editor-page')");
  });

  // The template builders (every Space's rooms and furniture) load when a template is picked, not with the editor.
  it('loads the template builders only on a template pick', () => {
    for (const path of [
      'components/start/useTemplatePickMove.ts',
      'app/document/[id]/useTemplateFlow.ts',
    ]) {
      const src = read(path);
      expect(staticImports(src), path).not.toContain('@/lib/template-builders');
      expect(src, path).toContain("import('@/lib/template-builders')");
    }
    // What the editor reads statically from the templates package stays clear of the builders.
    const pkg = (file: string) =>
      readFileSync(join(root, '../../packages/templates/src', file), 'utf8');
    expect(staticImports(pkg('template-tab.ts'))).not.toContain('./template-floors');
    expect(staticImports(pkg('template-floor-names.ts'))).toEqual([]);
    expect(staticImports(pkg('blank-pad-drop.ts'))).toEqual([]);
  });
});
