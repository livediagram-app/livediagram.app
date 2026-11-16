// The Library's calls (liveworkspace/docs/specs/006-media/libraries.md "Each app's door"): this app's `/api/library`,
// with the caller's identity headers like every other call (the access token when signed in, else the guest token).
import {
  createLibraryApi,
  type LibraryApi,
} from '@liveworkspace/workbench/lib/library/library-api';
import { API_BASE, apiFetch, apiHeaders } from './core';

export function libraryApiFor(ownerId: string): LibraryApi {
  return createLibraryApi(async (path, init) =>
    apiFetch(`${API_BASE}/library${path}`, {
      method: init.method,
      headers: await apiHeaders(ownerId, { body: init.body !== undefined }),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}
