// /api/documents/<id>/community: the owner's side of Community (docs/specs/025-community/community.md
// "Publishing"). GET reads the document's post, PUT publishes it or saves an Edit Listing, DELETE removes it from
// Community. Every app answers it the same way (@liveworkspace/community/app owner-route.ts); this finds the
// document, checks the caller owns it, and gives the shared route what only livedocuments knows: its index, its
// participants, and whether the first tab's first page has something to show (the post's card picture).

import {
  answerCommunityOwner,
  communityAuthorOf,
  isCommunityOwnerMethod,
} from '@liveworkspace/community/app';
import { communityOn, communityService } from '../community-service';
import { readDocumentMeta } from '../document-room/document-content';
import { indexFor } from '../index-service';
import { getParticipant } from '../person/profiles';
import { conflict, json, noContent, notFound, signInRequired } from '../responses';
import { firstPageHasElements } from '../thumbnail';
import { grantCallerOf, ownsDocument, type DocumentRouteContext } from './context';

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

  // The document's owner alone, holding its grant (the index's word that it is theirs to manage).
  const doc = await readDocumentMeta(env, id);
  if (!doc || !(await ownsDocument(ctx, { id, ownerId: doc.ownerId }))) return notFound();
  return answerCommunityOwner({
    request,
    documentId: id,
    env,
    service: communityService,
    db: env.DOCUMENT_DB,
    doc,
    accountUserId: ctx.accountUserId ?? null,
    index: indexFor(env, grantCallerOf(ctx)),
    author: async (ownerId) => communityAuthorOf(await getParticipant(env, ownerId)),
    hasSomethingToShow: () => firstPageHasElements(env, id),
    responses,
  });
}
