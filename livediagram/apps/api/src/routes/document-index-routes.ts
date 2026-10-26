// The document list and the document doors that are the index's (to the Trash, a copy, a share link), for API clients
// (index-adapters.ts).

import {
  DOCUMENT_CONVERSION_HEADER,
  isAccessLevel,
  readDocumentConversion,
} from '@livediagram/api-schema';
import type { ShareLinkExpiry } from '@liveworkspace/index-client';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { countCommunityCopy } from '../community-service';
import { documentRoom } from '../document-client';
import { capStoredName } from '../names';
import { json, noContent } from '../responses';
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
      // Take Offline (docs/specs/006-document/offline-mode.md) bypasses the Trash: the canvas now lives only in
      // the browser that took it.
      const offline =
        readDocumentConversion(request.headers.get(DOCUMENT_CONVERSION_HEADER)) === 'offline';
      const permanent = offline || ['1', 'true'].includes(url.searchParams.get('permanent') ?? '');
      await client.deleteItem(id, offline ? { permanent, reason: 'offline' } : { permanent });
      return noContent();
    }
    const body = await readOptionalBody(request);
    if (isCopy) {
      // The copy's name meets the name cap (docs/specs/006-document/name-length.md). A copy through a Community
      // post's link is named after the post (docs/specs/025-community/community.md "Making a copy"): the author's
      // own canvas name was never published.
      const share = shareAccessOf(request);
      const named = typeof body.name === 'string' ? capStoredName(body.name, null, 'document') : '';
      const post =
        !named && share ? await documentRoom(ctx.env, id).communityPostTitle(share.code) : null;
      const title = named || (post ? capStoredName(post, null, 'document') : '');
      // A copy through the post's open link counts toward it (docs/specs/025-community/community.md "Likes"): once
      // per copier, and at most a few from one network, so it is counted here, where the copier's network is
      // known, before the index copies (whose own count, routes/internal-items.ts, then adds nothing).
      const copier = ctx.verifiedUserId ?? ctx.resolveOwner();
      if (post !== null && share && copier)
        await countCommunityCopy(ctx.env, id, copier, clientRateKey(request));
      const { item } = await client.copyItem(id, title ? { title } : {}, share);
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
