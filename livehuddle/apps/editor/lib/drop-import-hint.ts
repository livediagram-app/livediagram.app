// What a file dropped on the canvas is told when it is a format the Import dialog reads (docs/specs/020-import-export/
// excalidraw-import-export.md "Dropped files"). The canvas lands only Excalidraw scenes where they are released; a
// livehuddle JSON file replaces the tab's content, so it goes through Import, and its refusal says so rather than
// asking for an Excalidraw file. (The draw.io, Mermaid and Markdown imports are gone, Work Tracker #423 part 4: such a
// file is refused as any other file the canvas does not take.)

const IMPORT_FORMATS: readonly { label: string; extensions: readonly string[] }[] = [
  { label: 'a livehuddle export', extensions: ['.json'] },
];

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  const name = file.name.toLowerCase();
  const format = IMPORT_FORMATS.find((f) => f.extensions.some((ext) => name.endsWith(ext)));
  return format ? `To bring in ${format.label}, use Import in the tab menu.` : null;
}
