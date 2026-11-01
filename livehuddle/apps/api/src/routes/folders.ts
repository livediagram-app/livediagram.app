// The caller's own folders, for API clients (index-adapters.ts): the list, and a new one (the CLI's `folder create`).

import { createFolderFor } from '@liveworkspace/index-app';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { clientFor, folderOf, listFolders, refusal } from './index-adapters';

// GET /api/folders, POST /api/folders.
export async function handleFolders(ctx: RouteContext): Promise<Response> {
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
    const folders = await listFolders(client, 'personal');
    return json({ folders: folders.map(folderOf) });
  } catch (err) {
    return refusal(err);
  }
}
