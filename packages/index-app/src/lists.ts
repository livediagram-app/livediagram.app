// What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on an
// app's api share, answering from the index: its refusals as the app answers them, and its pages read in full.
// Each list is paged at the index (at most LIST_LIMIT_MAX a page); these read at most LIST_PAGES pages.

import {
  IndexError,
  LIST_LIMIT_MAX,
  type App,
  type Folder,
  type IndexClient,
  type Item,
} from '@liveworkspace/index-client';

export const LIST_PAGES = 5;

// The index's refusal as an app answers it: its status and code.
export function indexRefusal(err: unknown): { status: number; error: string } {
  if (err instanceof IndexError) return { status: err.status, error: err.code };
  console.error('[index] unreachable', { error: String(err) });
  return { status: 503, error: 'index_unavailable' };
}

export async function allPages<T>(
  read: (cursor: string | undefined) => Promise<{ list: T[]; nextCursor: string | null }>,
  pages = LIST_PAGES,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < pages; page++) {
    const { list, nextCursor } = await read(cursor);
    out.push(...list);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return out;
}

export const listAllItems = (client: IndexClient, app: App, team: string): Promise<Item[]> =>
  allPages((cursor) =>
    client
      .listItems({ app, team, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.items, nextCursor: p.nextCursor })),
  );

export const listAllFolders = (client: IndexClient, team: string): Promise<Folder[]> =>
  allPages((cursor) =>
    client
      .listFolders({ team, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.folders, nextCursor: p.nextCursor })),
  );
