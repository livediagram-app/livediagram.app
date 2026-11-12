// FakeGoogle's replies (fake-google.ts): the CORS headers every answer carries, JSON and Drive-style error
// bodies, a file as Drive v3 shapes it for one user, and the thumbnail a write's content hints carry.

import type { FakeFile } from './drive-store';
import { validateThumbnail } from './thumbnail';

export const DEFAULT_FILE_FIELDS = 'kind,id,name,mimeType';
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization,content-type,x-upload-content-type,x-goog-drive-resource-keys',
  'Access-Control-Expose-Headers': 'Location',
};

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
  });
}

export function driveError(status: number, reason: string, message = reason): Response {
  return jsonResponse(status, {
    error: { code: status, message, errors: [{ domain: 'global', reason, message }] },
  });
}

export function driveFileShape(file: FakeFile, user: string): Record<string, unknown> {
  return {
    kind: 'drive#file',
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: [...file.parents],
    trashed: file.trashed,
    explicitlyTrashed: file.explicitlyTrashed,
    appProperties: { ...file.appProperties },
    ...(file.md5Checksum ? { md5Checksum: file.md5Checksum } : {}),
    ...(file.headRevisionId ? { headRevisionId: file.headRevisionId } : {}),
    version: String(file.version),
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
    ownedByMe: file.owner === user,
    capabilities: { canEdit: file.owner === user, canTrash: file.owner === user },
    ...(file.thumbnail ? { hasThumbnail: true } : {}),
  };
}

export function thumbnailFromHints(meta: Record<string, unknown>): FakeFile['thumbnail'] {
  const hints = meta.contentHints as
    { thumbnail?: { image?: string; mimeType?: string } } | undefined;
  if (!hints?.thumbnail) return null;
  return validateThumbnail(hints.thumbnail.image ?? '', hints.thumbnail.mimeType ?? '');
}
