// /api/walkthroughs: livedesign's door onto its designs' walkthroughs (liveworkspace/docs/specs/006-media/
// walkthroughs.md "Each app's door"; docs/specs/012-collaboration/walkthroughs.md). @liveworkspace/media's
// handleWalkthroughDoor does the work; this binds what is livedesign's: the caller's media owner, whether they are a
// person in their own editor, and the index's grant on the design, closed to a tab-scoped link, a Community visit and
// a design in the Trash.

import { handleWalkthroughDoor } from '@liveworkspace/media';
import { itemPayerScope, proEnabled } from '@liveworkspace/subscription';
import { designRoom } from '../design-client';
import { mediaClient, mediaOwner } from '../media';
import { CORS_HEADERS, json } from '../responses';
import type { RouteContext } from './context';
import { resolveDesignGrant } from './design-grant';

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
      const grant = await resolveDesignGrant(ctx, d);
      if (!grant || grant instanceof Response) return grant;
      const post = grant.shareCode ? await designRoom(ctx.env, d).community() : null;
      return {
        level: grant.level,
        closed:
          grant.trashed === true ||
          grant.tab !== null ||
          (post !== null && post.code === grant.shareCode),
        // Whose item it is, for the service to read its tier beside the recorder's (walkthroughs.md "With Pro on").
        itemOwner: itemPayerScope(grant),
      };
    },
    pro: proEnabled(ctx.env.PRO_ENABLED),
    calls: mediaClient(ctx.env)?.walkthroughs ?? null,
    request: ctx.request,
    json,
    corsHeaders: CORS_HEADERS,
  });
}
