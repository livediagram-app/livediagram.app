// /api/participants/<id> — read / update a participant's display row, and
// /api/participants/<id>/picture — set or clear their published profile picture.

import { isProfilePictureUrl } from '@livediagram/api-schema';
import { getParticipant, setParticipantPicture, upsertParticipant } from '../db';
import { badRequest, forbidden, json, notFound, signInRequired } from '../responses';
import type { ParticipantDTO } from '../types';
import { requireOwner, type RouteContext } from './context';
import { MAX_PARTICIPANT_NAME_LEN, MAX_COLOR_LEN } from '../limits';

// GET stays open — participant ids are already broadcast through
// the WS room and embedded in comment authors, so anyone in a
// shared session can already learn the id; the endpoint just
// exposes display name + colour, which the same shared session
// surfaces in every cursor / activity entry anyway. The published
// profile picture is the exception: it goes only to a signed-in
// caller (docs/specs/014-identity/profile-picture.md §5), so an anonymous
// share-link visitor reads null.
//
// PUT is owner-only on the participant. Without this guard any
// caller who knew (or guessed) another participant's id could
// rewrite their display name + colour, and that vandalism would
// propagate across every document they'd collaborated on. The guard requires the caller's resolved
// owner (Clerk Bearer OR X-Owner-Id, docs/specs/014-identity/auth-and-guest-access.md) to match the
// participant id being mutated.
export async function handleParticipants(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'participants') return notFound();
  if (segments.length === 4 && segments[3] === 'picture' && request.method === 'PUT') {
    return putPicture(ctx, segments[2]!);
  }
  if (segments.length !== 3) return notFound();
  const id = segments[2]!;
  if (request.method === 'GET') {
    const p = await getParticipant(env, id);
    if (!p) {
      // Your own profile, not saved yet (a fresh visitor): expected state, so a 200 with no
      // participant rather than a 404 every browser logs as an error (docs/specs/015-api/api.md).
      // Says nothing a 404 would not: the id is absent either way.
      if (ctx.resolveOwner() === id) {
        console.info('[participants] self_absent');
        return json({ participant: null });
      }
      return notFound();
    }
    return json({ participant: { ...p, pictureUrl: ctx.verifiedUserId ? p.pictureUrl : null } });
  }
  if (request.method === 'PUT') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    if (owner !== id) return forbidden();
    const body = (await request.json()) as Partial<ParticipantDTO>;
    if (!body.name || !body.color) return badRequest('missing name/color');
    // Cap the presence identity: it's broadcast to every peer in the room.
    if (body.name.length > MAX_PARTICIPANT_NAME_LEN || body.color.length > MAX_COLOR_LEN) {
      return badRequest('name/color too long');
    }
    const existing = await getParticipant(env, id);
    const now = Date.now();
    const p: ParticipantDTO = {
      id,
      name: body.name,
      color: body.color,
      createdAt: existing?.createdAt ?? now,
      pictureUrl: existing?.pictureUrl ?? null,
    };
    await upsertParticipant(env, p);
    return json({ participant: p });
  }
  return notFound();
}

// Only the participant's own verified Clerk session may publish a picture: a guest header proves
// nothing about a Clerk picture, and an API token must not be able to change how its owner looks
// to other people. The URL must be on Clerk's image host (docs/specs/014-identity/profile-picture.md §6).
async function putPicture(ctx: RouteContext, id: string): Promise<Response> {
  if (!ctx.clerkUserId) {
    console.info('[profile-picture] rejected', 'not_account');
    return signInRequired();
  }
  if (ctx.clerkUserId !== id) {
    console.info('[profile-picture] rejected', 'not_account');
    return forbidden();
  }
  const body = (await ctx.request.json().catch(() => null)) as { pictureUrl?: unknown } | null;
  const pictureUrl = body?.pictureUrl ?? null;
  if (pictureUrl !== null && !isProfilePictureUrl(pictureUrl)) {
    console.info('[profile-picture] rejected', 'invalid_url');
    return badRequest('invalid_picture_url');
  }
  if (!(await setParticipantPicture(ctx.env, id, pictureUrl))) return notFound();
  return json({ pictureUrl });
}
