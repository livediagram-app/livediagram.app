// /api/participants/<id>: read / set someone's display name and presence colour
// (docs/specs/014-identity/auth-and-guest-access.md "Identity display name"). Both are the person's
// liveworkspace profile (accounts/profiles.ts), the same in every app; livedesign keeps no copy.

import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from '@livedesign/api-schema';
import { isSafeColourValue } from '@livedesign/design';
import { getStoredProfile, ProfileError, writeParticipant } from '../accounts/profiles';
import { badRequest, forbidden, json, notFound } from '../responses';
import type { ParticipantDTO } from '../types';
import { requireOwner, type RouteContext, readBody } from './context';

// GET stays open: participant ids are already broadcast through the WS room and embedded in comment
// authors, so anyone in a shared session can already learn the id; the endpoint just exposes display name
// + colour, which the same shared session surfaces in every cursor and comment anyway.
//
// PUT is owner-only. Without this guard any caller who knew (or guessed) another participant's id could
// rewrite their display name + colour, and that would follow them into every app. The guard requires the
// caller's resolved owner (an account's or a guest's token) to match the id being changed.
export async function handleParticipants(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'participants') return notFound();
  if (segments.length !== 3) return notFound();
  const id = segments[2]!;
  if (request.method === 'GET') {
    const self = ctx.resolveOwner() === id;
    let profile;
    try {
      profile = await getStoredProfile(env, id);
    } catch (err) {
      console.warn('[participants] read_failed', err instanceof Error ? err.message : 'unknown');
      return json({ error: 'profile_unavailable' }, { status: 503 });
    }
    // Your own profile, when you have set nothing yet (a fresh visitor, or an account that has only ever
    // shown its account name): a 200 with no participant rather than a 404 every browser logs as an error
    // (docs/specs/015-api/api.md), so the editor picks a colour and saves it.
    if (self && !profile.ownSet) {
      console.info('[participants] self_absent');
      return json({ participant: null });
    }
    // Named, so it reads as this route answering about the id rather than no route at all.
    if (!profile.participant) return json({ error: 'participant_not_found' }, { status: 404 });
    // Their Google picture goes only to a signed-in reader (liveworkspace/docs/accounts.md "Profile pictures"):
    // a guest or a link visitor gets the name and colour alone.
    const picture = ctx.verifiedUserId ? profile.picture : null;
    return json({
      participant: picture ? { ...profile.participant, picture } : profile.participant,
    });
  }
  if (request.method === 'PUT') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    if (owner !== id) return forbidden();
    const read = await readBody(ctx);
    if (read instanceof Response) return read;
    const body = read as Partial<Record<keyof ParticipantDTO, unknown>>;
    if (
      typeof body.name !== 'string' ||
      typeof body.color !== 'string' ||
      !body.name ||
      !body.color
    )
      return badRequest('missing name/color');
    // A colour is painted into every peer's CSS (a card's stripe, a cursor): one that could load
    // something from outside is no colour (@livedesign/design unsafe-colours.ts).
    if (!isSafeColourValue(body.color)) return badRequest('invalid color');
    // Cap the presence identity: it's broadcast to every peer in the room.
    if (body.name.length > MAX_PARTICIPANT_NAME_LEN || body.color.length > MAX_COLOR_LEN) {
      return badRequest('name/color too long');
    }
    let stored;
    try {
      stored = await writeParticipant(env, id, { name: body.name, color: body.color });
    } catch (err) {
      if (err instanceof ProfileError) {
        console.warn('[participants] write_refused', { status: err.status, code: err.code });
        return json({ error: err.code }, { status: err.status === 404 ? 404 : 400 });
      }
      console.warn('[participants] write_failed', err instanceof Error ? err.message : 'unknown');
      return json({ error: 'profile_unavailable' }, { status: 503 });
    }
    // No accounts Worker to keep it (a deployment with no sign-in): answered as sent, and the editor keeps
    // it in the browser.
    const participant: ParticipantDTO = stored?.participant ?? {
      id,
      name: body.name,
      color: body.color,
      createdAt: Date.now(),
    };
    return json({ participant });
  }
  return notFound();
}
