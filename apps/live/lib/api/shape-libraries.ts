// Shape library calls (docs/specs/013-workspace/shape-libraries.md "API"): list / create / update /
// delete. Owner-scoped like custom themes; guests included (apiHeaders attaches the Clerk token when
// signed in, else the X-Owner-Id header).
import {
  MAX_SHAPE_LIBRARIES_PER_OWNER,
  type ShapeLibrary,
  type ShapeLibraryItem,
  type ShapeLibrarySource,
} from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, ApiError, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

type LibraryResponse = { library: ShapeLibrary };
type LibrariesResponse = { libraries: ShapeLibrary[] };

// Deduped: the editor and an open Explorer page can both ask on the same owner.
async function _apiListShapeLibraries(ownerId: string): Promise<ShapeLibrary[]> {
  const res = await apiFetch(`${API_BASE}/shape-libraries`, { headers: await apiHeaders(ownerId) });
  const { libraries } = await expectOk<LibrariesResponse>(res, 'list shape libraries');
  return libraries;
}
export const apiListShapeLibraries = dedupeInFlight(_apiListShapeLibraries, (ownerId) => ownerId);

export async function apiCreateShapeLibrary(
  ownerId: string,
  input: { id: string; name: string; source: ShapeLibrarySource; items: ShapeLibraryItem[] },
): Promise<ShapeLibrary> {
  const res = await apiFetch(`${API_BASE}/shape-libraries`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  return (await expectOk<LibraryResponse>(res, 'create shape library')).library;
}

export async function apiUpdateShapeLibrary(
  ownerId: string,
  id: string,
  patch: { name?: string; items?: ShapeLibraryItem[] },
): Promise<ShapeLibrary> {
  const res = await apiFetch(`${API_BASE}/shape-libraries/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  return (await expectOk<LibraryResponse>(res, 'update shape library')).library;
}

export async function apiDeleteShapeLibrary(ownerId: string, id: string): Promise<void> {
  return apiDelete(`${API_BASE}/shape-libraries/${encodeURIComponent(id)}`, ownerId, {
    action: 'delete shape library',
  });
}

export const SHAPE_LIBRARY_SAVE_FAILED = "Couldn't save this shape library. Try again.";
export const SHAPE_LIBRARY_TOO_LARGE = 'This library is too large to store.';

/** What a failed create or change tells the person (blueprint "Interfaces and contracts"). */
export function shapeLibraryErrorCopy(error: unknown): string {
  if (!(error instanceof ApiError)) return SHAPE_LIBRARY_SAVE_FAILED;
  if (error.status === 413) return SHAPE_LIBRARY_TOO_LARGE;
  if (error.code === 'shape_library_cap') {
    return `You have ${MAX_SHAPE_LIBRARIES_PER_OWNER} shape libraries already. Delete one to add another.`;
  }
  if (error.code === 'shape_library_name_taken')
    return 'You already have a library with that name.';
  return SHAPE_LIBRARY_SAVE_FAILED;
}
