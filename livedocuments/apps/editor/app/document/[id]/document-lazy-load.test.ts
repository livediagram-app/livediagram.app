// What the document page loads on demand (docs/specs/016-platform/web-performance.md; lib/editor-deferred-code.ts).
// Each of these was a static import that put a surface most visits never open, or content most boards never
// draw, in every document's first load: together about 224 KiB gzipped. A static import of any of them again
// passes every other test; this one fails.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);
const importsOf = (path: string) => staticImports(read(path));

// Every app file a module reaches through static imports and re-exports (the `@/` alias and relative paths), each
// with the specifiers it names: what lands in the module's first load from this app's own code.
const reexports = (src: string) =>
  [...src.matchAll(/^export\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);
function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith('@/')
    ? spec.slice(2)
    : spec.startsWith('.')
      ? join(dirname(from), spec)
      : null;
  if (base === null) return null;
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', ''])
    if (existsSync(join(root, base + ext)) && /\.tsx?$/.test(base + ext)) return base + ext;
  return null;
}
function staticClosure(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const src = read(file);
    const specs = [...staticImports(src), ...reexports(src)];
    seen.set(file, specs);
    for (const spec of specs) {
      const next = resolveLocal(file, spec);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

describe('the document page’s first load', () => {
  it.each([
    ['app/document/[id]/EditorView.tsx', '@/components/panels/EditorSearchPanel'],
    ['components/tour/EditorTours.tsx', '@/components/tour/PlanTourHost'],
    ['components/tour/EditorTours.tsx', '@/components/tour/ElementTourHost'],
    ['app/document/[id]/editor-page.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/Explorer'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/CanvasPages'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/article/ArticleFlows'],
    ['components/canvas/CanvasChrome.tsx', '@/components/canvas/whiteboard/WhiteboardDock'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/TableView'],
    ['components/canvas/QuickStyleHost.tsx', '@/components/canvas/QuickStylePanel'],
    ['components/canvas/PresentationHost.tsx', '@/components/canvas/PresentationOverlay'],
  ])('%s loads %s on demand', (file, module) => {
    expect(importsOf(file)).not.toContain(module);
  });

  it('loads the tool panels on demand', () => {
    const imports = importsOf('components/canvas/useCanvasToolPanels.tsx');
    expect(imports.filter((m) => m.startsWith('@/components/panels/'))).toEqual([]);
  });

  it('takes the template overrides from the builders loaded at the press', () => {
    const src = read('app/document/[id]/useTemplateFlow.ts');
    expect(src).not.toMatch(/^import\s+\{[^}]*\btemplateCanvasOverrides\b/m);
  });

  // The article editor's ProseMirror (about 26 KiB gzipped) loads with the first article: a one-symbol import of the
  // caps plugin's module, for the toast its notice goes to, once put it in every document's first load.
  it('reaches no ProseMirror module through its static imports', () => {
    const reached = staticClosure('app/document/[id]/editor-page.tsx');
    const prosemirror = [...reached.entries()].filter(([, specs]) =>
      specs.some((s) => s.startsWith('prosemirror-')),
    );
    expect(prosemirror.map(([file]) => file)).toEqual([]);
  });

  // The Explorer opens only from the canvas's menu button (docs/specs/007-editor/toolbar-layout.md): the status
  // screens (deleted, couldn't load, not found) render neither it nor its code.
  it('shows no Explorer panel on the status screens', () => {
    expect(read('app/document/[id]/editor-page.tsx')).not.toMatch(
      /LazyExplorer|panels\/Explorer\b/,
    );
  });
});
