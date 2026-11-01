// /api/documents/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"; blueprint §4 and §5 G1 to G3). GET reads the canvas's post, PUT publishes it or saves an Edit
// Listing, DELETE removes it from Community. Every app answers it the same way (@liveworkspace/community/app
// owner-route.ts); this finds the canvas, checks the caller owns it, and gives the shared route what only
// livediagram knows: its index, its participants and whether the first tab has something to show.

import {
  answerCommunityOwner,
  communityAppClient,
  communityAuthorOf,
  communityOn,
  isCommunityOwnerMethod,
} from '@liveworkspace/community/app';
import { COMMUNITY_APP } from '../community-service';
import { firstTabElementCount } from '../db';
import { getParticipant } from '../liveworkspace/profiles';
import { readDocumentMeta } from '../document-room/document-content';
import { indexFor } from '../index-service';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { grantCallerOf, ownsDocument, type DocumentRouteContext } from './context';

const service = communityAppClient(COMMUNITY_APP);
const responses = { json, notFound, noContent, conflict, signInRequired };

// Returns null when the request isn't this route.
export async function handleCommunityOwnerRoutes(
  ctx: DocumentRouteContext,
): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'community') return null;
  if (!isCommunityOwnerMethod(request.method)) return null;
  const id = segments[2]!;
  // Switched off, or with no service to publish to, a document has no Community post to read, publish or remove.
  if (!communityOn(env)) return notFound();

  // The canvas's owner alone, holding its grant (the index's word that it is theirs to manage).
  const doc = await readDocumentMeta(env, id);
  if (!doc || !(await ownsDocument(ctx, { id, ownerId: doc.ownerId }))) return notFound();
  return answerCommunityOwner({
    request,
    documentId: id,
    env,
    service,
    db: env.DOCUMENT_DB,
    doc,
    accountUserId: ctx.accountUserId ?? null,
    index: indexFor(env, grantCallerOf(ctx)),
    author: async (ownerId) => communityAuthorOf(await getParticipant(env, ownerId)),
    hasSomethingToShow: async () => (await firstTabElementCount(env, id)) > 0,
    responses,
  });
}
