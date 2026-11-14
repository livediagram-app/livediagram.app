// The caller's own folders, for API clients (the MCP server, the CLI, any script with an `lwt_` token):
// GET /api/folders lists them, POST /api/folders makes one (the CLI's `folder create`). Every product's api binds it
// once at module scope with its own answers, its owner check, its index client and its folder shape.

import type { Folder, IndexClient } from '@liveworkspace/index-client';
import { createFolderFor, indexRefusal, listAllFolders } from './lists';

type FoldersContext = { request: Request; segments: readonly string[] };

export type FoldersRouteDeps<Ctx extends FoldersContext, Out> = {
  /** The product's CORS-bound JSON answer. */
  json: (body: unknown, init?: ResponseInit) => Response;
  notFound: () => Response;
  /** The signed-in caller, or the product's 401. */
  requireOwner: (ctx: Ctx) => string | Response;
  /** The index as this caller reaches it, or the 503 a deployment without one answers. */
  clientFor: (ctx: Ctx) => IndexClient | Response;
  /** An index folder as the product's API clients read it. */
  folderOf: (folder: Folder) => Out;
};

/** The `/api/folders` route, bound to a product's pieces. */
export function createFoldersRoute<Ctx extends FoldersContext, Out>(
  deps: FoldersRouteDeps<Ctx, Out>,
): (ctx: Ctx) => Promise<Response> {
  const { json, notFound, requireOwner, clientFor, folderOf } = deps;
  return async (ctx) => {
    const { request, segments } = ctx;
    if (segments.length !== 2 || (request.method !== 'GET' && request.method !== 'POST')) {
      return notFound();
    }
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    const client = clientFor(ctx);
    if (client instanceof Response) return client;
    if (request.method === 'POST') {
      const made = await createFolderFor(client, request);
      if ('error' in made) return json({ error: made.error }, { status: made.status });
      return json({ folder: folderOf(made.folder) }, { status: 201 });
    }
    try {
      const folders = await listAllFolders(client, 'personal');
      return json({ folders: folders.map(folderOf) });
    } catch (err) {
      const { status, error } = indexRefusal(err);
      return json({ error }, { status });
    }
  };
}
