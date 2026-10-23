// The document list and the document doors that are the index's (to the Trash, a copy, a share link), for API clients
// (index-adapters.ts).

import { isAccessLevel } from '@livedocuments/api-schema';
import type { ShareLinkExpiry } from '@liveworkspace/index-client';
import { json } from '../responses';
import { readOptionalBody, requireOwner, shareAccessOf, type RouteContext } from './context';
import { clientFor, listItems, refusal, shareLinkOf, summaryOf } from './index-adapters';

// GET /api/documents.
export async function handleDocumentList(ctx: RouteContext): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  try {
    const items = await listItems(client, 'personal');
    return json({ documents: items.map(summaryOf) });
  } catch (err) {
    return refusal(err);
  }
}

// DELETE /api/documents/:id, POST /api/documents/:id/copy and /share. Null for anything else.
export async function handleDocumentIndexRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, segments, url } = ctx;
  const id = segments[2];
  if (!id) return null;
  const isDelete = segments.length === 3 && request.method === 'DELETE';
  const isCopy = segments.length === 4 && segments[3] === 'copy' && request.method === 'POST';
  const isShare = segments.length === 4 && segments[3] === 'share' && request.method === 'POST';
  if (!isDelete && !isCopy && !isShare) return null;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  try {
    if (isDelete) {
      const permanent = ['1', 'true'].includes(url.searchParams.get('permanent') ?? '');
      await client.deleteItem(id, { permanent });
      return new Response(null, { status: 204 });
    }
    const body = await readOptionalBody(request);
    if (isCopy) {
      const title = typeof body.name === 'string' ? body.name : undefined;
      const { item } = await client.copyItem(id, title ? { title } : {}, shareAccessOf(request));
      return json({ document: { ...summaryOf(item), tabs: [] } }, { status: 201 });
    }
    const level = isAccessLevel(body.role) ? body.role : undefined;
    const expiry = typeof body.expiry === 'string' ? (body.expiry as ShareLinkExpiry) : undefined;
    const tabId = typeof body.tabId === 'string' ? body.tabId : undefined;
    const { link } = await client.createShareLink(id, {
      ...(level ? { level } : {}),
      ...(expiry ? { expiry } : {}),
      ...(tabId ? { tabId } : {}),
    });
    return json({ link: shareLinkOf(link) }, { status: 201 });
  } catch (err) {
    return refusal(err);
  }
}
