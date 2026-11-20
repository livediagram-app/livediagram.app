// What a file dropped on the canvas is told when the canvas does not take it. The canvas lands only images where they
// are released; a Markdown file, a liveknowledge JSON export, or a Word document replaces the page's
// content, so it goes through Import, and its refusal says so: or, on a tab whose Import does not take that file
// (docs/specs/020-import-export/markdown-import.md "Where it is offered"), which tabs do.
import type { ImportFormatKey } from './import-formats';

const IMPORT_FORMATS: readonly {
  key: ImportFormatKey;
  label: string;
  extensions: readonly string[];
  takenBy: string;
}[] = [
  {
    key: 'markdown',
    label: 'a Markdown file',
    extensions: ['.md', '.markdown'],
    takenBy: 'a page of writing',
  },
  { key: 'json', label: 'a liveknowledge export', extensions: ['.json'], takenBy: 'any page' },
  {
    key: 'word',
    label: 'a Word document',
    extensions: ['.docx', '.docm', '.dotx'],
    takenBy: 'a page of writing',
  },
];

/** The refusal for any other file dropped on the canvas. */
export const DROP_NOT_AN_IMAGE = 'Drop an image to place it on the canvas.';

/** The refusal for a dropped file the Import dialog can read, or null for any other file. `offered` is what this
 *  tab's Import takes (importFormatsFor); absent, every format. */
export function dropImportHint(
  file: Pick<File, 'name'>,
  offered?: readonly ImportFormatKey[],
): string | null {
  const name = file.name.toLowerCase();
  const format = IMPORT_FORMATS.find((f) => f.extensions.some((ext) => name.endsWith(ext)));
  if (!format) return null;
  if (offered && !offered.includes(format.key)) {
    return `${format.label[0]!.toUpperCase()}${format.label.slice(1)} imports into ${format.takenBy}.`;
  }
  return `To bring in ${format.label}, use Import in the page menu.`;
}
