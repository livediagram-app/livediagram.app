// /api/projects/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"). GET reads the plan's post, PUT publishes it or saves an Edit Listing, DELETE removes it from
// Community. Every app answers it the same way (@liveworkspace/community/app owner-route.ts); this finds the
// plan, checks the caller owns it, and gives the shared route what only liveplanner knows: its index, its
// participants, and whether the first tab has something to show (the post's card picture).

import {
  answerCommunityOwner,
  communityAuthorOf,
  isCommunityOwnerMethod,
} from '@liveworkspace/community/app';
import { communityOn, communityService } from '../community-service';
import { readPlanMeta } from '../plan-room/plan-content';
import { indexFor } from '../index-service';
import { getParticipant } from '../person/profiles';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { firstTabHasSomethingToShow } from '../thumbnail';
import { grantCallerOf, ownsProject, type PlanRouteContext } from './context';

const responses = { json, notFound, noContent, conflict, signInRequired };

// Returns null when the request isn't this route.
export async function handleCommunityOwnerRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  if (!isCommunityOwnerMethod(request.method)) return null;
  const id = segments[2]!;
  // Switched off, or with no service to publish to, a plan has no Community post to read, publish or remove.
  if (!communityOn(env)) return notFound();

  // The plan's owner alone, holding its grant (the index's word that it is theirs to manage).
  const doc = await readPlanMeta(env, id);
  if (!doc || !(await ownsProject(ctx, { id, ownerId: doc.ownerId }))) return notFound();
  return answerCommunityOwner({
    request,
    documentId: id,
    env,
    service: communityService,
    db: env.PLAN_DB,
    doc,
    accountUserId: ctx.accountUserId ?? null,
    index: indexFor(env, grantCallerOf(ctx)),
    author: async (ownerId) => communityAuthorOf(await getParticipant(env, ownerId)),
    hasSomethingToShow: () => firstTabHasSomethingToShow(env, id),
    responses,
  });
}
