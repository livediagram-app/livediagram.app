// What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on this
// api share, answering from the index (liveworkspace/docs/specs/004-index/one-explorer.md): the index as the caller reaches it, its
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
// page); these read at most @liveworkspace/index-app's LIST_PAGES pages (1,000 plans), which is what the clients that call them can use.

import { allPages, indexRefusal, listAllFolders, listAllItems } from '@liveworkspace/index-app';
import {
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

// The index as this caller reaches it, or the 503 a deployment without one answers.
export function clientFor(ctx: RouteContext): IndexClient | Response {
  const client = indexFor(ctx.env, grantCallerOf(ctx));
  return client ?? json({ error: 'index_unavailable' }, { status: 503 });
}

// The index's refusal as this api answers it: its status and code.
export function refusal(err: unknown): Response {
  const { status, error } = indexRefusal(err);
  return json({ error }, { status });
}

export { allPages };

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
  listAllItems(client, INDEX_APP, team);

export const listFolders = listAllFolders;
