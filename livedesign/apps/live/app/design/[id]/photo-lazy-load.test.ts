// A photo page's code loads only for a tab that has one (docs/specs/031-photo/photo-pages.md, docs/specs/016-platform/
// web-performance.md): the pixel engine, its filters, PSD and the GPU compositor are hundreds of KiB, and the editor's
// first load, and every other Pages tab's, must never carry them. The editor's always-loaded files reach the photo
// editor only through a dynamic import.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

// The modules only a photo page needs.
const PHOTO_ONLY =
  /^@\/components\/photo\/(?!photo-title-bar-room$)|^@\/lib\/photo-editor\/(session|runtime|layer-ops|photo-actions|photo-commands|preview|start-photo|surface-painter|gl\/|tools)/;

describe('a photo page’s code', () => {
  it('is never imported statically by the editor’s canvas, chrome, pages or state', () => {
    for (const file of [
      'components/canvas/Canvas.tsx',
      'components/canvas/CanvasChrome.tsx',
      'components/dialogs/ExportTabDialog.tsx',
      'components/canvas/CanvasPages.tsx',
      'components/canvas/useCanvasChromePanels.tsx',
      'components/canvas/page-title-bar-room.ts',
      'hooks/canvas/useEditorCommands.ts',
      'app/design/[id]/useAutosave.ts',
      'hooks/editor/usePhotoEditor.ts',
      'hooks/editor/usePhotoFraming.ts',
      'app/design/[id]/useEditorState.ts',
    ])
      expect(
        staticImports(read(file)).filter((m) => PHOTO_ONLY.test(m)),
        file,
      ).toEqual([]);
  });

  // A dynamic import still loads the moment its component renders: the photo view is there for every Pages tab (Edit
  // as Photo makes a tab's first photo page), so each surface renders only once the tab has a photo page.
  it('renders none of its surfaces for a tab without a photo page', () => {
    expect(
      read('components/canvas/Canvas.tsx').match(/pagesMode\?\.photo\?\.hasPhotoPage \? \(/g),
    ).toHaveLength(2);
    expect(read('components/canvas/CanvasChrome.tsx')).toContain(
      'chromeHidden || !props.pagesMode?.photo?.hasPhotoPage ? null',
    );
  });

  it('loads the working parts once a tab has a photo page', () => {
    expect(read('hooks/editor/usePhotoEditor.ts')).toContain(
      "import('@/lib/photo-editor/runtime')",
    );
    for (const loader of ['PhotoPagesLayer', 'PhotoCanvasOverlays', 'PhotoChrome', 'PhotoPanel'])
      expect(read('lib/editor-deferred-code.ts')).toContain(
        `import('@/components/photo/${loader}')`,
      );
  });
});
