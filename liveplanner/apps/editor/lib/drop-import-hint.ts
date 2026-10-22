// What a file dropped or pasted on the canvas is told: the canvas takes no files (pictures are never uploaded). A
// liveplanner JSON export replaces the tab's content, so it goes through Import, and its refusal says so.

/** The refusal for any other file dropped or pasted on the canvas. */
export const FILE_NOT_TAKEN = 'Files cannot be added to the canvas.';

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  return file.name.toLowerCase().endsWith('.json')
    ? 'To bring in a liveplanner export, use Import in the tab menu.'
    : null;
}
