// What a file dropped or pasted on the canvas is told. A livehuddle JSON file replaces the tab's content, so it goes
// through Import, and its refusal says so; any other file, a picture too, is not something the canvas takes
// (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card").
// (Imports from other tools are gone, docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools":
// a dropped .excalidraw file is refused as any other file.)

const IMPORT_FORMATS: readonly { label: string; extensions: readonly string[] }[] = [
  { label: 'a livehuddle export', extensions: ['.json'] },
];

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  const name = file.name.toLowerCase();
  const format = IMPORT_FORMATS.find((f) => f.extensions.some((ext) => name.endsWith(ext)));
  return format ? `To bring in ${format.label}, use Import in the tab menu.` : null;
}

/** Said when a file dropped or pasted on the canvas is not one Import reads. */
export const DROP_NOT_TAKEN = 'The canvas does not take files.';
