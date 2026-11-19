// A file made beside an item (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it", its
// blueprint "Making beside it", Work Tracker 1281): `POST /items/:id/beside` makes a new item of the person's own
// from a template's offer through its app's template door, as a kit's part is made, then connects it in the host's
// tab as Connect File does. Only on the person's own press: nothing here runs by itself.

import { BESIDE_OFFERS, besideTitle, readBesideInput } from '@liveworkspace/index-client';
import { callAppForJson } from './app-calls';
import { isId } from './codec';
import { KIT_CREATE_TIMEOUT_MS } from './config';
import { connectTo, hostForConnect, isDelegate } from './connections';
import type { RouteContext } from './context';
import { badRequest, forbidden, json, notFound, readObject, unauthorized } from './http';
import { overRunLimit } from './kits';
import { drainTombstonesSoon, purgeRows } from './purge';
import { getItemRow } from './rows';

export async function makeBeside(ctx: RouteContext, hostId: string): Promise<Response> {
  const { request, env, caller } = ctx;
  if (request.method !== 'POST') return notFound();
  const person = caller.person;
  if (!person) return unauthorized();
  // Agents make items through their own apps; a guest cannot keep the file it would make.
  if (isDelegate(person)) return forbidden();
  if (person.kind === 'guest') return forbidden('sign_in_required');
  const limited = await overRunLimit(env, `beside:${person.id}`);
  if (limited) return limited;
  const input = readBesideInput(await readObject(request));
  if (!input) return badRequest();

  const host = await hostForConnect(ctx, person, hostId, input.tabId);
  if (host instanceof Response) return host;
  const offer = BESIDE_OFFERS[input.offer];
  // Beside the host in the person's own My Work; at its top when the host is someone else's or a team's.
  const folderId = host.owner_id === person.id && host.team_id === null ? host.folder_id : null;
  const res = await callAppForJson(
    env,
    offer.app,
    '/items/from-template',
    { owner: person.id, folderId, name: besideTitle(host.title, offer), template: offer.template },
    KIT_CREATE_TIMEOUT_MS,
  );
  const id = res.ok ? res.body.id : undefined;
  const made = isId(id) ? await getItemRow(env, id) : null;
  if (
    !made ||
    made.owner_id !== person.id ||
    made.team_id !== null ||
    made.app !== offer.app ||
    made.trashed_at !== null ||
    made.archived_at !== null
  ) {
    console.warn('[beside] file not made', {
      app: offer.app,
      error: res.ok ? 'invalid_item' : res.error,
    });
    return json({ error: 'unavailable' }, { status: 503 });
  }

  const answer = await connectTo(ctx, person, host, made, input);
  if (answer.status !== 201) {
    // Refused (the host's or the file's limits): the starter made a moment ago goes for good, so a refusal leaves
    // nothing behind.
    await purgeRows(env, [{ id: made.id, app: made.app }], Date.now(), { actorId: person.id });
    ctx.waitUntil(drainTombstonesSoon(env, [made.id]));
  }
  console.info('[beside] made', { offer: offer.id, status: answer.status });
  return answer;
}
