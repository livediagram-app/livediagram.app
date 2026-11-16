// Bringing an SVG onto the canvas as editable shapes (docs/specs/020-import-export/svg-import.md): the one entry the
// Import dialog, a drop and a paste share. It picks the page, runs the importer (lazy-loaded, so its code stays out
// of the editor's first bundle), commits every path in one step and selects them, or places a file too big for
// shapes as a picture. Drop and paste say how it went in a toast; the dialog gets the report back to show.
import {
  MAX_ELEMENTS_PER_TAB,
  savableElements,
  type LaidOutPage,
  type Element,
} from '@livedesign/design';
import { currentPageIdNow } from '@/lib/current-page-kind';
import type { ImportOutcome } from '@/lib/import-tab';
import type { SvgImportRoute } from '@/lib/svg-import/import-svg';
import { svgReportLines, svgReportToast } from '@/lib/svg-import/report';
import { SVG_IMPORT_MAX_BYTES } from '@/lib/svg-import/constants';
import { track } from '@/lib/telemetry';
import type { useToast } from '@/hooks/ui/useToast';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

export const SVG_PICTURE_FALLBACK =
  'This SVG is too large to bring in as shapes, so it was placed as a picture.';
export const SVG_UNREADABLE = "This file isn't an SVG we can read.";
export const SVG_NOTHING_TO_IMPORT = 'Nothing in this SVG could be brought in as shapes.';

export type SvgImportOptions = {
  // The canvas point it was dropped at.
  at?: Point;
  // Places the file as a picture (the paste path's image upload), for a file too big for shapes.
  placePicture?: (file: File, at?: Point) => unknown;
  // The file the text came from, placed as the picture when it is too big; one past the size cap is never read.
  file?: File;
};

type SvgImportDeps = {
  // True (after explaining) when nothing may be created right now: the paste and drop gates.
  refuseCreate: () => boolean;
  isReadOnly: boolean;
  elementCount: number;
  pages: readonly LaidOutPage[];
  getViewportCanvasRect?: () => Rect | null;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  toast: ReturnType<typeof useToast>;
};

export function useSvgImport(deps: SvgImportDeps) {
  const importSvg = async (
    text: string,
    route: SvgImportRoute,
    opts: SvgImportOptions = {},
  ): Promise<ImportOutcome> => {
    const say = (message: string): ImportOutcome => {
      if (route === 'dialog') return { status: 'error', error: message };
      deps.toast.info(message);
      return { status: 'done' };
    };
    if (deps.isReadOnly || deps.refuseCreate()) return { status: 'cancelled' };
    const placePicture = (at: Point | undefined): ImportOutcome => {
      if (!opts.placePicture) return say(SVG_UNREADABLE);
      const file = opts.file ?? new File([text], 'imported.svg', { type: 'image/svg+xml' });
      void opts.placePicture(file, at);
      deps.toast.info(SVG_PICTURE_FALLBACK);
      return { status: 'done' };
    };
    if (opts.file && opts.file.size > SVG_IMPORT_MAX_BYTES) return placePicture(opts.at);
    const [{ importSvgText }, { landingBox, landingPage }, { loadCombineEngine }] =
      await Promise.all([
        import('@/lib/svg-import/import-svg'),
        import('@/lib/svg-import/landing'),
        import('@/lib/combine/combine'),
      ]);
    const view = deps.getViewportCanvasRect?.() ?? null;
    const page = landingPage(deps.pages, { at: opts.at, currentPageId: currentPageIdNow(), view });
    const box = landingBox(page, view);
    const result = await importSvgText(text, box, route, { loadEngine: loadCombineEngine });

    const asPicture = () =>
      placePicture(opts.at ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 });

    if (result.kind === 'picture') return asPicture();
    if (result.kind === 'unreadable') return say(SVG_UNREADABLE);
    if (result.kind === 'empty') {
      const lines = result.report ? svgReportLines(result.report) : [];
      return say([SVG_NOTHING_TO_IMPORT, ...lines.map((l) => l.message)].join(' '));
    }
    // Only what the api will save lands, and only while the tab has room: past it, the file is a picture.
    const { elements } = savableElements(result.paths);
    if (elements.length === 0) return say(SVG_NOTHING_TO_IMPORT);
    if (deps.elementCount + elements.length > MAX_ELEMENTS_PER_TAB) return asPicture();
    deps.commit((els) => [...els, ...elements]);
    if (elements.length === 1) {
      deps.setSelectedId(elements[0]!.id);
      deps.setMultiSelectedIds(new Set());
    } else {
      deps.setSelectedId(null);
      deps.setMultiSelectedIds(new Set(elements.map((el) => el.id)));
    }
    track('Tab', 'Imported', 'Svg');
    if (route === 'dialog') return { status: 'done', failures: svgReportLines(result.report) };
    deps.toast.info(svgReportToast(elements.length, result.report));
    return { status: 'done' };
  };

  return { importSvg };
}
