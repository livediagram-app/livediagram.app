// The Import dialog's runners with SVG routed to the SVG importer (docs/specs/020-import-export/svg-import.md
// "Where an SVG comes in"): JSON replaces the tab through the tab import, SVG adds shapes to the page.
import type { ImportFormat } from '@/hooks/persistence/useTabImport';
import type { ImportOutcome } from '@/lib/import-tab';
import { SVG_IMPORT_MAX_BYTES } from './constants';

const LOCKED: ImportOutcome = {
  status: 'error',
  error: 'This tab is locked. Unlock it before importing.',
};

type PickFile = (
  accept: string,
  opts: { maxBytes?: number },
) => Promise<{ text: string; file?: File } | null>;

export function svgAwareImporters(deps: {
  importText: (format: ImportFormat, text: string) => Promise<ImportOutcome>;
  importFile: (format: ImportFormat) => Promise<ImportOutcome>;
  importSvg: (text: string, file?: File) => Promise<ImportOutcome>;
  locked: boolean;
  // The file picker (lib/import-tab's pickTabFile); injectable for tests.
  pickFile?: PickFile;
}) {
  const onImportText = (format: ImportFormat, text: string): Promise<ImportOutcome> => {
    if (format !== 'svg') return deps.importText(format, text);
    if (deps.locked) return Promise.resolve(LOCKED);
    return deps.importSvg(text);
  };
  const onImportFile = async (format: ImportFormat): Promise<ImportOutcome> => {
    if (format !== 'svg') return deps.importFile(format);
    if (deps.locked) return LOCKED;
    const pick = deps.pickFile ?? (await import('@/lib/import-tab')).pickTabFile;
    // A file past the cap is never read: it goes in as a picture (useSvgImport).
    const picked = await pick('.svg,image/svg+xml', { maxBytes: SVG_IMPORT_MAX_BYTES });
    if (!picked) return { status: 'cancelled' };
    return deps.importSvg(picked.text, picked.file);
  };
  return { onImportText, onImportFile };
}
