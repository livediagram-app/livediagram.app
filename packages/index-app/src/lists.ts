// What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on an
// app's api share, answering from the index: its refusals as the app answers them, and its pages read in full.
// Each list is paged at the index (at most LIST_LIMIT_MAX a page); these read at most LIST_PAGES pages.

import {
  IndexError,
  LIST_LIMIT_MAX,
  type App,
  type CreateFolderInput,
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
  listItemsAsked(client, app, { team });

// What an API client asks of a list (GET /api/<collection>): `team` as the index takes it (`personal` unless the client
// asks for `all`: mine and every joined team, the index's unset `team`), the index's search words `q` (each in the
// title or the folder's name), and `limit`, one page of at most that many, newest saved first. Without a `limit`,
// every page up to LIST_PAGES; without `q` or `team=all`, the personal library as it always answered. `archived=1` (or
// `true`) lists the caller's Archived instead (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Archived"), the index's `view=archived`: the archived items alone, searched and capped as any list is.
export type ListAsked = { team: string | undefined; q?: string; limit?: number; archived?: true };

const LIMIT = /^[1-9]\d*$/;
// `archived=0` (or `false`) is the live list, as no `archived` is.
const ARCHIVED_FLAGS = new Set(['1', 'true', '0', 'false']);

export function listAskedOf(params: URLSearchParams): ListAsked | { error: 'invalid_query' } {
  const team = params.get('team');
  const q = params.get('q')?.trim();
  const limit = params.get('limit');
  const archived = params.get('archived');
  if (team !== null && team !== 'all') return { error: 'invalid_query' };
  if (archived !== null && !ARCHIVED_FLAGS.has(archived)) return { error: 'invalid_query' };
  if (limit !== null && (!LIMIT.test(limit) || Number(limit) > LIST_LIMIT_MAX))
    return { error: 'invalid_query' };
  return {
    team: team === 'all' ? undefined : 'personal',
    ...(q ? { q } : {}),
    ...(limit !== null ? { limit: Number(limit) } : {}),
    ...(archived === '1' || archived === 'true' ? { archived: true as const } : {}),
  };
}

// The items a list asks for, as the index answers them: one page when it gives a `limit`, else every page.
export function listItemsAsked(client: IndexClient, app: App, asked: ListAsked): Promise<Item[]> {
  const query = {
    app,
    ...(asked.team !== undefined ? { team: asked.team } : {}),
    ...(asked.q !== undefined ? { q: asked.q } : {}),
    ...(asked.archived ? { view: 'archived' as const } : {}),
  };
  if (asked.limit !== undefined)
    return client.listItems({ ...query, limit: asked.limit }).then((p) => p.items);
  return allPages((cursor) =>
    client
      .listItems({ ...query, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.items, nextCursor: p.nextCursor })),
  );
}

export const listAllFolders = (client: IndexClient, team: string): Promise<Folder[]> =>
  allPages((cursor) =>
    client
      .listFolders({ team, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.folders, nextCursor: p.nextCursor })),
  );

// POST /api/folders for an API client (the CLI's `folder create`): the body `{name, id?, parentId?, teamId?}` passed
// to the index as the caller, which checks the name, the parent and the team. Answers the new folder, or a refusal.
export async function createFolderFor(
  client: IndexClient,
  request: Request,
): Promise<{ folder: Folder } | { status: number; error: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, error: 'invalid_json' };
  }
  const input = createFolderInputOf(body);
  if (!input) return { status: 400, error: 'invalid_body' };
  try {
    return await client.createFolder(input);
  } catch (err) {
    return indexRefusal(err);
  }
}

const optionalString = (v: unknown): v is string | null | undefined =>
  v === undefined || v === null || typeof v === 'string';

export function createFolderInputOf(body: unknown): CreateFolderInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { id, name, parentId, teamId } = body as Record<string, unknown>;
  if (typeof name !== 'string' || id === null || !optionalString(id)) return null;
  if (!optionalString(parentId) || !optionalString(teamId)) return null;
  return {
    name,
    ...(id !== undefined ? { id } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
  };
}
