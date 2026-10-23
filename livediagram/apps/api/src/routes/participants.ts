// /api/participants/<id> — read / update a participant's display name and colour, kept by
// liveworkspace as the person's profile in every app (liveworkspace/profiles.ts).

import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from '@livediagram/api-schema';
import { isSafeColourValue } from '@livediagram/document';
import { ProfileError } from '@liveworkspace/auth-client';
import { getParticipant, setParticipant } from '../liveworkspace/profiles';
import { badRequest, forbidden, json, notFound } from '../responses';
import type { ParticipantDTO } from '../types';
import { requireOwner, type RouteContext, readBody } from './context';

// GET stays open — participant ids are already broadcast through
// the WS room and embedded in comment authors, so anyone in a
// shared session can already learn the id; the endpoint just
// exposes display name + colour, which the same shared session
// surfaces in every cursor and comment anyway.
//
// PUT is owner-only on the participant. Without this guard any
// caller who knew (or guessed) another participant's id could
// rewrite their display name + colour, and that vandalism would
// propagate across every document they'd collaborated on. The guard requires the caller's resolved
// owner (account or guest Bearer, docs/specs/014-identity/auth-and-guest-access.md) to match the
// participant id being mutated.
export async function handleParticipants(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'participants') return notFound();
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
    return json({ participant: p });
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
    // something from outside is no colour (@livediagram/document unsafe-colours.ts).
    if (!isSafeColourValue(body.color)) return badRequest('invalid color');
    // Cap the presence identity: it's broadcast to every peer in the room.
    if (body.name.length > MAX_PARTICIPANT_NAME_LEN || body.color.length > MAX_COLOR_LEN) {
      return badRequest('name/color too long');
    }
    let p: ParticipantDTO | null;
    try {
      p = await setParticipant(env, id, { name: body.name, color: body.color });
    } catch (err) {
      // liveworkspace refused the values (its own checks match the ones above): a 400 like ours.
      if (err instanceof ProfileError) return badRequest(`invalid ${err.code}`);
      throw err;
    }
    // Nowhere to keep it (a guest-only self-host, docs/specs/015-api/api.md "participants"): the
    // editor keeps the name it chose, and presence carries it to everyone in the room.
    return json({
      participant: p ?? { id, name: body.name, color: body.color, createdAt: Date.now() },
    });
  }
  return notFound();
}
