// /api/designs/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"). GET reads the design's post, PUT publishes it or saves an Edit Listing, DELETE removes it from
// Community. Every app answers it the same way (@liveworkspace/community/app owner-route.ts); this finds the
// design, checks the caller owns it, and gives the shared route what only livedesign knows: its index, its
// participants, and whether the first tab's first page has something to show (the post's card picture).

import {
  answerCommunityOwner,
  communityAuthorOf,
  isCommunityOwnerMethod,
} from '@liveworkspace/community/app';
import { communityOn, communityService } from '../community-service';
import { readDesignMeta } from '../design-room/design-content';
import { indexFor } from '../index-service';
import { getParticipant } from '../accounts/profiles';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { firstPageHasSomethingToShow } from '../thumbnail';
import { grantCallerOf, ownsDesign, type DesignRouteContext } from './context';

const responses = { json, notFound, noContent, conflict, signInRequired };

// Returns null when the request isn't this route.
export async function handleCommunityOwnerRoutes(
  ctx: DesignRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  if (!isCommunityOwnerMethod(request.method)) return null;
  const id = segments[2]!;
  // Switched off, or with no service to publish to, a design has no Community post to read, publish or remove.
  if (!communityOn(env)) return notFound();

  // The design's owner alone, holding its grant (the index's word that it is theirs to manage).
  const doc = await readDesignMeta(env, id);
  if (!doc || !(await ownsDesign(ctx, { id, ownerId: doc.ownerId }))) return notFound();
  return answerCommunityOwner({
    request,
    documentId: id,
    env,
    service: communityService,
    db: env.DESIGN_DB,
    doc,
    accountUserId: ctx.accountUserId ?? null,
    index: indexFor(env, grantCallerOf(ctx)),
    author: async (ownerId) => communityAuthorOf(await getParticipant(env, ownerId)),
    hasSomethingToShow: () => firstPageHasSomethingToShow(env, id),
    responses,
  });
}
