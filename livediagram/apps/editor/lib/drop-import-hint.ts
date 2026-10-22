// What a file dropped on the canvas is told when it is a format the Import dialog reads (docs/specs/020-import-export/
// excalidraw-import-export.md "Dropped files"). The canvas lands only Excalidraw scenes where they are released; a
// draw.io, Mermaid, Markdown or livediagram JSON file replaces the tab's content, so it goes through Import, and its
// refusal says so rather than asking for an Excalidraw file.

const IMPORT_FORMATS: readonly { label: string; extensions: readonly string[] }[] = [
  { label: 'a draw.io file', extensions: ['.drawio', '.dio', '.drawio.xml'] },
  { label: 'a Mermaid file', extensions: ['.mmd', '.mermaid'] },
  { label: 'a Markdown file', extensions: ['.md', '.markdown'] },
  { label: 'a livediagram export', extensions: ['.json'] },
];

/** The refusal for a dropped file the Import dialog can read, or null for any other file. */
export function dropImportHint(file: Pick<File, 'name'>): string | null {
  const name = file.name.toLowerCase();
  const format = IMPORT_FORMATS.find((f) => f.extensions.some((ext) => name.endsWith(ext)));
  return format ? `To bring in ${format.label}, use Import in the tab menu.` : null;
}
