// What a file dropped on the canvas is told when the canvas does not take it. The canvas lands only images where they
// are released; a Markdown file or a livedocuments JSON export replaces the tab's content, so it goes through Import,
// and its refusal says so.

const IMPORT_FORMATS: readonly { label: string; extensions: readonly string[] }[] = [
  { label: 'a Markdown file', extensions: ['.md', '.markdown'] },
  { label: 'a livedocuments export', extensions: ['.json'] },
];

/** The refusal for any other file dropped on the canvas. */
export const DROP_NOT_AN_IMAGE = 'Drop an image to place it on the canvas.';

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  const name = file.name.toLowerCase();
  const format = IMPORT_FORMATS.find((f) => f.extensions.some((ext) => name.endsWith(ext)));
  return format ? `To bring in ${format.label}, use Import in the tab menu.` : null;
}
