// /api/walkthroughs: liveknowledge' door onto its documents' walkthroughs (liveworkspace/docs/specs/006-media/
// walkthroughs.md "Each app's door"; docs/specs/012-collaboration/walkthroughs.md). @liveworkspace/media's
// handleWalkthroughDoor does the work; this binds what is liveknowledge': the caller's media owner, whether they are a
// person in their own editor, and the index's grant on the document, closed to a tab-scoped link, a Community visit and
// a document in the Trash.

import { handleWalkthroughDoor } from '@liveworkspace/media';
import { documentRoom } from '../document-client';
import { mediaClient, mediaOwner } from '../media';
import { CORS_HEADERS, json } from '../responses';
import type { RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

export async function handleWalkthroughs(ctx: RouteContext): Promise<Response> {
  // The door's verbs (handleWalkthroughDoor): GET and POST the list, GET and DELETE one, GET and PUT its media.
  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    return json({ error: 'not_found' }, { status: 404 });
  }
  const owner = ctx.resolveOwner();
  return handleWalkthroughDoor({
    method,
    // Read by literal index, so the route parity probe can follow it.
    path: [ctx.segments[2], ctx.segments[3], ctx.segments[4]].filter(
      (s): s is string => s !== undefined,
    ),
    itemId: ctx.url.searchParams.get('d'),
    owner: owner ? await mediaOwner(owner) : null,
    person: owner !== null && !ctx.token && !ctx.workbench,
    access: async (d) => {
      const grant = await resolveDocumentGrant(ctx, d);
      if (!grant || grant instanceof Response) return grant;
      const post = grant.shareCode ? await documentRoom(ctx.env, d).community() : null;
      return {
        level: grant.level,
        closed:
          grant.trashed === true ||
          grant.tab !== null ||
          (post !== null && post.code === grant.shareCode),
      };
    },
    calls: mediaClient(ctx.env)?.walkthroughs ?? null,
    request: ctx.request,
    json,
    corsHeaders: CORS_HEADERS,
  });
}
