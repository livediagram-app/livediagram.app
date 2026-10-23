// The caller's own folders, for API clients (index-adapters.ts).

import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { clientFor, folderOf, listFolders, refusal } from './index-adapters';

// GET /api/folders.
export async function handleFolders(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments.length !== 2 || request.method !== 'GET') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  try {
    const folders = await listFolders(client, 'personal');
    return json({ folders: folders.map(folderOf) });
  } catch (err) {
    return refusal(err);
  }
}
