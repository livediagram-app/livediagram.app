import { sanitizeFilename } from '@liveworkspace/model-core/file-name';

/** A tab export's file name before its extension (docs/specs/020-import-export/export-fidelity.md "File names"):
 *  `<item> - <tab>`, ` - selection` added for a selection, through the shared `sanitizeFilename`, so it is safe
 *  on every platform, keeps letters in any script, and a name of nothing safe downloads as the editor's `noun`
 *  ("document", "design"). */
export function tabExportBaseName(
  itemName: string,
  tabName: string,
  isSelection: boolean,
  noun = 'document',
): string {
  const suffix = isSelection ? ' - selection' : '';
  return sanitizeFilename(`${itemName || noun} - ${tabName || 'tab'}${suffix}`, noun);
}
