// /api/participants/<id> — read / update a participant's display row.

import { getParticipant, upsertParticipant } from '../db';
import { badRequest, forbidden, json, notFound } from '../responses';
import type { ParticipantDTO } from '../types';
import { requireOwner, type RouteContext } from './context';

// GET stays open — participant ids are already broadcast through
// the WS room and embedded in change-log rows, so anyone in a
// shared session can already learn the id; the endpoint just
// exposes display name + colour, which the same shared session
// surfaces in every cursor / activity entry anyway.
//
// PUT is owner-only on the participant. Without this guard any
// caller who knew (or guessed) another participant's id could
// rewrite their display name + colour — and because change-log
// rows store name + colour denormalised at write time, that
// vandalism would propagate across every diagram they'd
// collaborated on. The guard requires the caller's resolved
// owner (Clerk Bearer OR X-Owner-Id, spec/04) to match the
// participant id being mutated.
export async function handleParticipants(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (!(segments[1] === 'participants' && segments.length === 3)) return notFound();
  const id = segments[2]!;
  if (request.method === 'GET') {
    const p = await getParticipant(env, id);
    return p ? json({ participant: p }) : notFound();
  }
  if (request.method === 'PUT') {
    const owner = requireOwner(ctx);
    if (owner instanceof Response) return owner;
    if (owner !== id) return forbidden();
    const body = (await request.json()) as Partial<ParticipantDTO>;
    if (!body.name || !body.color) return badRequest('missing name/color');
    const existing = await getParticipant(env, id);
    const now = Date.now();
    const p: ParticipantDTO = {
      id,
      name: body.name,
      color: body.color,
      createdAt: existing?.createdAt ?? now,
    };
    await upsertParticipant(env, p);
    return json({ participant: p });
  }
  return notFound();
}
