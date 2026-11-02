// What the Explorer's "Import from" asks the /import page for, and where it returns
// (docs/specs/013-workspace/folders.md "Import from").
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';
import { IMPORT_SOURCES, type ImportSourceId } from './import-sources';

export type ImportRequest = {
  source: ImportSourceId;
  what: 'items' | 'libraries';
  folderId: string | null;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The import `?source=&what=&folder=` asks for, or null for an unknown source. */
export function importRequestOf(params: URLSearchParams): ImportRequest | null {
  const source = IMPORT_SOURCES.find((s) => s.id === params.get('source'))?.id;
  if (!source) return null;
  const folder = params.get('folder');
  return {
    source,
    what: params.get('what') === 'libraries' ? 'libraries' : 'items',
    folderId: folder && ID.test(folder) ? folder : null,
  };
}

/** The Explorer page the imports landed on: Shape Libraries, the folder, or All. */
export function importReturnUrl(request: ImportRequest): string {
  if (request.what === 'libraries') return explorerHref('shape-libraries');
  if (request.folderId)
    return explorerHref('folder', `?id=${encodeURIComponent(request.folderId)}`);
  return explorerHref('all');
}
