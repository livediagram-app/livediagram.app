// The Library's routes as an app's Worker calls them (liveworkspace/docs/specs/006-media/libraries.md "The API"): every
// route a POST with the actor in its body. Bound into `createMediaClient` as `client.library`.

import type {
  LibraryActor,
  LibraryItemSummary,
  LibraryListResponse,
  LibraryPlaceResponse,
  LibraryScope,
  LibrarySaveInput,
} from './library';

// What a call answers: the service's own result shape (client.ts `MediaResult`), repeated here to keep this file free
// of the client it is bound into.
export type LibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; body: { error: string } & Record<string, unknown> };

type Post = <T>(path: string, body: unknown) => Promise<LibraryResult<T>>;

export function libraryCalls(post: Post) {
  return {
    /** The actor's Personal and team items, without the kinds the asking app can't draw. */
    list: (actor: LibraryActor, kinds: readonly string[]) =>
      post<LibraryListResponse>('/list', { actor, kinds }),
    /** Save an item to Personal or one of the actor's teams. */
    save: (actor: LibraryActor, input: LibrarySaveInput) =>
      post<{ item: LibraryItemSummary }>('/save', { actor, ...input }),
    /** An item's elements, to place: a team's pictures copied into the actor's gallery first. */
    place: (actor: LibraryActor, id: string) => post<LibraryPlaceResponse>('/place', { actor, id }),
    rename: (actor: LibraryActor, id: string, title: string) =>
      post<{ item: LibraryItemSummary }>('/rename', { actor, id, title }),
    renameFolder: (
      actor: LibraryActor,
      input: { scope: LibraryScope; teamId?: string | null; from: string; to: string },
    ) => post<{ renamed: number }>('/rename-folder', { actor, ...input }),
    remove: (actor: LibraryActor, id: string) => post<{ ok: true }>('/delete', { actor, id }),
  };
}

export type LibraryCalls = ReturnType<typeof libraryCalls>;
