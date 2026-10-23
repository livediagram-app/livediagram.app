// What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on this
// api share, answering from the index (liveworkspace/docs/one-explorer.md): the index as the caller reaches it, its
// refusals as this api answers them, its pages read in full, and its shapes as the clients have always read them
// (@liveplanner/api-schema). Where a plan is filed, its Trash and its sharing are the index's; the doors are:
//
//   GET    /api/projects, DELETE /api/projects/:id, POST /api/projects/:id/copy|share   project-index-routes.ts
//   GET    /api/share/:code                                                            share.ts
//   GET    /api/folders                                                                folders.ts
//   GET    /api/teams, /api/teams/:id/library                                          teams.ts
//   GET    /api/trash, POST /api/trash/:id/restore, DELETE /api/trash/:id              trash.ts
//
// The editor calls the index itself, through `/api/index/*`. Each list is paged at the index (at most 200 a
// page); these read at most LIST_PAGES pages (1,000 plans), which is what the clients that call them can use.

import {
  IndexError,
  LIST_LIMIT_MAX,
  type Folder as IndexFolder,
  type IndexClient,
  type Item,
  type ShareLinkExpiry,
} from '@liveworkspace/index-client';
import {
  isAccessLevel,
  type Folder,
  type ProjectSummary,
  type ShareLink,
} from '@liveplanner/api-schema';
import { INDEX_APP, indexFor } from '../index-service';
import { json } from '../responses';
import { grantCallerOf, type RouteContext } from './context';

const LIST_PAGES = 5;

// The index as this caller reaches it, or the 503 a deployment without one answers.
export function clientFor(ctx: RouteContext): IndexClient | Response {
  const client = indexFor(ctx.env, grantCallerOf(ctx));
  return client ?? json({ error: 'index_unavailable' }, { status: 503 });
}

// The index's refusal as this api answers it: its status and code.
export function refusal(err: unknown): Response {
  if (err instanceof IndexError) return json({ error: err.code }, { status: err.status });
  console.error('[index] unreachable', { error: String(err) });
  return json({ error: 'index_unavailable' }, { status: 503 });
}

export async function allPages<T>(
  read: (cursor: string | undefined) => Promise<{ list: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < LIST_PAGES; page++) {
    const { list, nextCursor } = await read(cursor);
    out.push(...list);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return out;
}

// An index item as a plan summary. What the index does not keep (the stats' mode, the creation intent) reads as
// unknown.
export function summaryOf(item: Item): ProjectSummary {
  const s = item.summary ?? {};
  const elements = typeof s.elements === 'number' ? s.elements : null;
  return {
    id: item.id,
    ownerId: item.ownerId,
    name: item.title,
    shareable: false,
    shareCode: item.sharedVia,
    folderId: item.folderId,
    teamId: item.teamId,
    source: item.source === 'ai' ? 'mcp' : null,
    savedAt: item.updatedAt,
    createdAt: item.createdAt,
    empty: s.empty === true,
    stats:
      elements === null
        ? null
        : {
            mode: 'plan',
            elements,
            comments: typeof s.comments === 'number' ? s.comments : 0,
            bytes: typeof s.bytes === 'number' ? s.bytes : 0,
          },
    opensIn: null,
    tabKind: null,
    templateFamily: null,
  };
}

export function folderOf(f: IndexFolder): Folder {
  return {
    id: f.id,
    ownerId: f.ownerId,
    parentId: f.parentId,
    teamId: f.teamId,
    name: f.name,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export function shareLinkOf(link: {
  code: string;
  itemId: string;
  level: string;
  tabId: string | null;
  expiry: ShareLinkExpiry;
  expiresAt: number | null;
  createdAt: number;
}): ShareLink {
  return {
    code: link.code,
    projectId: link.itemId,
    role: isAccessLevel(link.level) ? link.level : 'view',
    createdAt: link.createdAt,
    expiry: link.expiry,
    expiresAt: link.expiresAt,
    tabId: link.tabId,
  };
}

export const listItems = (client: IndexClient, team: string) =>
  allPages((cursor) =>
    client
      .listItems({ app: INDEX_APP, team, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.items, nextCursor: p.nextCursor })),
  );

export const listFolders = (client: IndexClient, team: string) =>
  allPages((cursor) =>
    client
      .listFolders({ team, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
      .then((p) => ({ list: p.folders, nextCursor: p.nextCursor })),
  );
