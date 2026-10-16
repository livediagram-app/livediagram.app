// What the document page loads on demand (docs/specs/016-platform/web-performance.md; lib/editor-deferred-code.ts).
// Each of these was a static import that put a surface most visits never open, or content most boards never
// draw, in every document's first load: together about 224 KiB gzipped. A static import of any of them again
// passes every other test; this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);
const importsOf = (path: string) => staticImports(read(path));

describe('the document page’s first load', () => {
  it.each([
    ['app/document/[id]/EditorView.tsx', '@/components/panels/EditorSearchPanel'],
    ['components/chrome/EditorPhotoImport.tsx', '@/components/chrome/PhotoReviewOverlay'],
    ['components/chrome/EditorPhotoImport.tsx', '@/lib/photo-detect'],
    ['components/tour/EditorTours.tsx', '@/components/tour/PlanTourHost'],
    ['components/tour/EditorTours.tsx', '@/components/tour/ElementTourHost'],
    ['app/document/[id]/editor-page.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/Explorer'],
    ['components/canvas/useCanvasChromePanels.tsx', '@/components/panels/LayersPanel'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/IllustratePages'],
    ['components/canvas/Canvas.tsx', '@/components/canvas/article/ArticleFlows'],
    ['components/canvas/CanvasChrome.tsx', '@/components/canvas/whiteboard/WhiteboardDock'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/TableView'],
    ['components/canvas/ElementFaceRouter.tsx', '@/components/canvas/collab/CollabFaceRouter'],
    ['components/canvas/QuickStyleHost.tsx', '@/components/canvas/QuickStylePanel'],
    ['components/canvas/PresentationHost.tsx', '@/components/canvas/PresentationOverlay'],
    ['components/canvas/SessionTimerFace.tsx', '@/components/canvas/SessionElementSettings'],
    ['components/canvas/SessionSettingsMenu.tsx', '@/components/canvas/SessionElementSettings'],
    ['hooks/canvas/usePhotoDraft.ts', '@/lib/photo-detect'],
    ['hooks/canvas/usePhotoReread.ts', '@/lib/photo-detect'],
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
});
