// /api/participants/<id> — read / update a person's display name and colour, their profile at the
// liveworkspace accounts Worker (person/profiles.ts).

import { ProfileError } from '@liveworkspace/auth-client';
import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from '@liveplanner/api-schema';
import { isSafeColourValue } from '@liveplanner/project';
import { getParticipant, saveParticipant } from '../person/profiles';
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
// propagate across every project they'd collaborated on. The guard requires the caller's resolved
// owner (account Bearer OR X-Owner-Id, docs/specs/014-identity/auth-and-guest-access.md) to match the
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
    // something from outside is no colour (@liveplanner/project unsafe-colours.ts).
    if (!isSafeColourValue(body.color)) return badRequest('invalid color');
    // Cap the presence identity: it's broadcast to every peer in the room.
    if (body.name.length > MAX_PARTICIPANT_NAME_LEN || body.color.length > MAX_COLOR_LEN) {
      return badRequest('name/color too long');
    }
    try {
      const p = await saveParticipant(env, id, { name: body.name, color: body.color });
      return json({ participant: p });
    } catch (error) {
      // The accounts Worker refused it (its own checks of a name and colour) or can't be reached.
      if (error instanceof ProfileError) return badRequest(error.code);
      console.warn('[participants] save_failed', { error: String(error) });
      return json({ error: 'profile_unavailable' }, { status: 503 });
    }
  }
  return notFound();
}
