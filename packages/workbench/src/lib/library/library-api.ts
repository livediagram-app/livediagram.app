// The editor's calls to its app's Library door (liveworkspace/docs/specs/006-media/libraries.md "Each app's door"):
// `/api/library` on the app's own api. Each editor binds its own request (its api base and identity headers).

import type {
  LibraryItemSummary,
  LibraryListResponse,
  LibraryPlaceResponse,
  LibraryScope,
} from '@liveworkspace/media';

// One request to the door: `path` below `/api/library` ('' for the collection), a method and a JSON body.
export type LibraryRequest = (
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
) => Promise<Response>;

// A refused call: the door's error token (`admin_only`, `library_full`, …) and status.
export class LibraryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(`library: ${code} (${status})`);
    this.name = 'LibraryError';
    this.code = code;
    this.status = status;
  }
}

export type LibrarySaveRequest = {
  scope: LibraryScope;
  teamId: string | null;
  folder: string;
  title: string;
  width: number;
  height: number;
  elements: readonly unknown[];
};

async function answer<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new LibraryError(typeof body.error === 'string' ? body.error : 'failed', res.status);
  }
  return body as T;
}

const at = (id: string) => `/${encodeURIComponent(id)}`;

export function createLibraryApi(request: LibraryRequest) {
  return {
    list: async () => answer<LibraryListResponse>(await request('', { method: 'GET' })),
    save: async (input: LibrarySaveRequest) =>
      (
        await answer<{ item: LibraryItemSummary }>(
          await request('', { method: 'POST', body: input }),
        )
      ).item,
    place: async (id: string) =>
      answer<LibraryPlaceResponse>(await request(`${at(id)}/place`, { method: 'POST' })),
    rename: async (id: string, title: string) =>
      (
        await answer<{ item: LibraryItemSummary }>(
          await request(at(id), { method: 'PUT', body: { title } }),
        )
      ).item,
    renameFolder: async (input: {
      scope: LibraryScope;
      teamId: string | null;
      from: string;
      to: string;
    }) =>
      (await answer<{ renamed: number }>(await request('/folders', { method: 'PUT', body: input })))
        .renamed,
    remove: async (id: string) => {
      await answer<{ ok: true }>(await request(at(id), { method: 'DELETE' }));
    },
  };
}

export type LibraryApi = ReturnType<typeof createLibraryApi>;

// The words a refusal shows, by its token.
export function libraryErrorMessage(error: unknown): string {
  const code = error instanceof LibraryError ? error.code : '';
  switch (code) {
    case 'admin_only':
      return 'Only the team’s admins can change its library.';
    case 'library_full':
      return 'This library is full. Delete something to make room.';
    case 'item_too_large':
      return 'That selection is too large to save. Try fewer elements.';
    case 'gallery_full':
      return 'There’s no room for its pictures. Delete some from the gallery first.';
    case 'invalid_elements':
      return 'Something in that selection can’t be saved.';
    case 'not_found':
      return 'That item is no longer in the library.';
    default:
      return 'Couldn’t reach your library. Try again.';
  }
}
