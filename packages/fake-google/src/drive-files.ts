// The fake's file writes and answers (fake-google.ts): which files the app sees, a file made from its
// metadata, a metadata PATCH (rename, move, appProperties, trash) and the JSON a file answers with.

import type { DriveStore, FakeFile } from './drive-store';
import { parseFields, pickFields } from './fields';
import {
  DEFAULT_FILE_FIELDS,
  driveFileShape,
  jsonResponse,
  thumbnailFromHints,
} from './drive-responses';

export function respondFile(file: FakeFile, user: string, url: URL): Response {
  const fields = parseFields(url.searchParams.get('fields') ?? DEFAULT_FILE_FIELDS);
  return jsonResponse(200, pickFields(driveFileShape(file, user), fields));
}

export function visibleFile(store: DriveStore, user: string, id: string): FakeFile | null {
  const f = store.files.get(id);
  return f && store.appCanAccess(user, f) ? f : null;
}

export function createFromMetadata(
  store: DriveStore,
  user: string,
  meta: Record<string, unknown>,
  content: string,
  thumbnail?: FakeFile['thumbnail'],
): FakeFile {
  const parents = Array.isArray(meta.parents) ? (meta.parents as string[]) : ['root'];
  for (const p of parents) {
    if (p !== 'root' && !visibleFile(store, user, p)) throw new Error(`parent not found: ${p}`);
  }
  if (typeof meta.name !== 'string' || !meta.name) throw new Error('name required');
  return store.create({
    user,
    name: meta.name,
    mimeType: typeof meta.mimeType === 'string' ? meta.mimeType : 'application/octet-stream',
    parents,
    appProperties: (meta.appProperties as Record<string, string>) ?? {},
    content,
    viaApp: true,
    thumbnail: thumbnail ?? thumbnailFromHints(meta),
  });
}

export function applyMetadata(
  store: DriveStore,
  file: FakeFile,
  meta: Record<string, unknown>,
  url: URL,
  user: string,
): void {
  if (file.owner !== user && (meta.trashed !== undefined || url.searchParams.has('addParents'))) {
    throw new Error('insufficientFilePermissions');
  }
  const add = (url.searchParams.get('addParents') ?? '').split(',').filter(Boolean);
  const remove = (url.searchParams.get('removeParents') ?? '').split(',').filter(Boolean);
  for (const p of add) {
    if (p !== 'root' && !visibleFile(store, user, p)) throw new Error(`parent not found: ${p}`);
  }
  if (typeof meta.name === 'string') store.rename(file, meta.name);
  if (add.length > 0 || remove.length > 0) store.move(file, add, remove, user);
  if (meta.appProperties && typeof meta.appProperties === 'object') {
    store.setAppProperties(file, meta.appProperties as Record<string, string | null>);
  }
  if (typeof meta.trashed === 'boolean' && meta.trashed !== file.trashed) {
    store.setTrashed(file, meta.trashed);
  }
}
