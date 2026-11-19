import { BPMN_FILE_ACCEPT } from './bpmn/limits';
import { DRAWIO_TAB_FILE_ACCEPT } from './drawio/limits';
import { INFRA_FILE_ACCEPT } from './infra-import';
import { VISIO_TAB_FILE_ACCEPT } from './visio/limits';

// The files each Import format's picker takes (docs/specs/020-import-export/README.md "File types"), one table
// for the picker's `accept` and for the words the dialog shows, so the two never disagree.
export type ImportFileFormat =
  'json' | 'markdown' | 'mermaid' | 'excalidraw' | 'drawio' | 'visio' | 'bpmn' | 'infra';

export const IMPORT_FILE_ACCEPT: Record<ImportFileFormat, string> = {
  json: '.json,application/json',
  markdown: 'text/markdown,.md,.markdown,.mdown,.mkd,text/plain',
  mermaid: '.mmd,.mermaid,.txt,text/plain',
  excalidraw: '.excalidraw,.json,application/json,.png,image/png,.svg,image/svg+xml',
  drawio: DRAWIO_TAB_FILE_ACCEPT,
  visio: VISIO_TAB_FILE_ACCEPT,
  bpmn: BPMN_FILE_ACCEPT,
  infra: INFRA_FILE_ACCEPT,
};

/** The file endings a format's picker takes, as a reader knows them: `.toml`, `.yml`, `.yaml`. */
export function importFileTypes(format: ImportFileFormat): string[] {
  return IMPORT_FILE_ACCEPT[format].split(',').filter((t) => t.startsWith('.'));
}
