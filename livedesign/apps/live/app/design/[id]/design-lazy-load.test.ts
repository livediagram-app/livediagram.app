// What the design page loads on demand (docs/specs/016-platform/web-performance.md; lib/editor-deferred-code.ts).
// Each of these was a static import that put a surface most visits never open, or content most boards never
// draw, in every design's first load: together about 224 KiB gzipped. A static import of any of them again
// passes every other test; this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);
const importsOf = (path: string) => staticImports(read(path));

describe('the design page’s first load', () => {
  it.each([
    ['app/design/[id]/EditorView.tsx', '@/components/panels/EditorSearchPanel'],
    ['components/tour/EditorTours.tsx', '@/components/tour/ElementTourHost'],
    ['app/design/[id]/editor-page.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/LayersPanel'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/CanvasPages'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/TableView'],
    ['components/canvas/QuickStyleHost.tsx', '@/components/canvas/QuickStylePanel'],
  ])('%s loads %s on demand', (file, module) => {
    expect(importsOf(file)).not.toContain(module);
  });

  it('loads the tool panels on demand', () => {
    const imports = importsOf('components/canvas/useCanvasToolPanels.tsx');
    expect(imports.filter((m) => m.startsWith('@/components/panels/'))).toEqual([]);
  });

  it('takes the template overrides from the builders loaded at the press', () => {
    const src = read('app/design/[id]/useTemplateFlow.ts');
    expect(src).not.toMatch(/^import\s+\{[^}]*\btemplateCanvasOverrides\b/m);
  });

  // The Explorer opens only from the canvas's menu button (docs/specs/007-editor/toolbar-layout.md): the status
  // screens (deleted, couldn't load, not found) render neither it nor its code.
  it('shows no Explorer panel on the status screens', () => {
    expect(read('app/design/[id]/editor-page.tsx')).not.toMatch(/LazyExplorer|panels\/Explorer\b/);
  });
});
