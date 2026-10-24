// What the project page loads on demand (docs/specs/016-platform/web-performance.md; lib/editor-deferred-code.ts).
// Each of these was a static import that put a surface most visits never open, or content most boards never
// draw, in every project's first load: together about 224 KiB gzipped. A static import of any of them again
// passes every other test; this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);
const importsOf = (path: string) => staticImports(read(path));

describe('the project page’s first load', () => {
  it.each([
    ['app/project/[id]/EditorView.tsx', '@/components/panels/EditorSearchPanel'],
    ['components/tour/EditorTours.tsx', '@/components/tour/PlanTourHost'],
    ['components/tour/EditorTours.tsx', '@/components/tour/ElementTourHost'],
    ['app/project/[id]/editor-page.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/LayersPanel'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/CanvasPages'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/article/ArticleFlows'],
    ['components/canvas/CanvasChrome.tsx', '@/components/canvas/whiteboard/WhiteboardDock'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/TableView'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/collab/CollabFaceRouter'],
    ['components/canvas/SessionTimerFace.tsx', '@/components/canvas/SessionElementSettings'],
    ['components/canvas/SessionSettingsMenu.tsx', '@/components/canvas/SessionElementSettings'],
  ])('%s loads %s on demand', (file, module) => {
    expect(importsOf(file)).not.toContain(module);
  });

  it('takes the template overrides from the builders loaded at the press', () => {
    const src = read('app/project/[id]/useTemplateFlow.ts');
    expect(src).not.toMatch(/^import\s+\{[^}]*\btemplateCanvasOverrides\b/m);
  });

  // The Explorer opens only from the canvas's menu button (docs/specs/007-editor/toolbar-layout.md): the status
  // screens (deleted, couldn't load, not found) render neither it nor its code.
  it('shows no Explorer panel on the status screens', () => {
    expect(read('app/project/[id]/editor-page.tsx')).not.toMatch(/LazyExplorer|panels\/Explorer\b/);
  });
});
