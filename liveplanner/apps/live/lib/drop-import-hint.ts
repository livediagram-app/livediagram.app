// What a file dropped on the canvas is told when the canvas does not take it. The canvas lands only images where they
// are released; a liveplanner JSON export replaces the tab's content, so it goes through Import, and its refusal says
// so.

/** The refusal for any other file dropped on the canvas. */
export const DROP_NOT_AN_IMAGE = 'Drop an image to place it on the canvas.';

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  return file.name.toLowerCase().endsWith('.json')
    ? 'To bring in a liveplanner export, use Import in the tab menu.'
    : null;
}
