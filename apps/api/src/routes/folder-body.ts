// Field readers for the /api/folders bodies (docs/specs/013-workspace/folders.md "API"). A body is
// untrusted JSON, so a name that is null, a number or an object is a 400 here rather than a 500 from
// the NOT NULL column or a number stored as a name.

import { MAX_NAME_LEN } from '../limits';
import { badRequest } from '../responses';

// undefined = the field was absent (leave the name alone); a string = the validated name.
export function readFolderName(value: unknown): string | undefined | Response {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) return badRequest('invalid name');
  if (value.length > MAX_NAME_LEN) return badRequest('name too long');
  return value;
}

// undefined = absent (leave the parent alone), null = the space's root, a string = a folder id.
export function readParentId(value: unknown): string | null | undefined | Response {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || value.length === 0) return badRequest('invalid parentId');
  return value;
}
