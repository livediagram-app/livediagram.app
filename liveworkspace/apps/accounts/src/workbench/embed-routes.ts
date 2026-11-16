// A live embed's tickets (liveworkspace/docs/specs/011-workbench/workbench.md "Live embed tickets";
// liveworkspace/docs/specs/004-index/live-embeds.md): a host page asks, with the reader's own token, for a one-minute
// view ticket to the target app's workbench frame. The reader's own grant on the item decides; the level is always
// view; the ticket is bound to the host page's origin, which must be one of the apps'.
import type { App } from '@liveworkspace/index-client';
import { appOfOrigin } from '@liveworkspace/sites';
import { bearerOf, bearerPerson } from '../bearer.ts';
import { hasApiTokenPrefix } from '../tokens.ts';
import { teamsClaim } from '../teams.ts';
import { dialectOf, isAppName } from './apps.ts';
import { ownerItemAccess } from './index-access.ts';
import { workbenchStoreOf } from './store.ts';
import {
  WORKBENCH_TICKET_TTL_MS,
  type WorkbenchContext,
  badRequest,
  embedLimited,
  fail,
  invalidValue,
  isId,
  json,
  parseWorkbenchOrigin,
  rateLimited,
  signInRequired,
  tokenRequired,
} from './route-kit.ts';

// The apps with a workbench frame, the ones a live embed can show (@liveworkspace/element-model live-item.ts
// LIVE_EMBED_APPS, restated as the sheet sources restate theirs): livehuddle serves none.
const isTarget = (v: unknown): v is App => isAppName(v) && v !== 'livehuddle';

// The host page's origin: an app's in this environment, or any loopback origin in development (each app's dev servers
// answer on more than their router's port).
function hostOrigin(ctx: WorkbenchContext, value: unknown): string | null {
  const origin = parseWorkbenchOrigin(value);
  if (!origin) return null;
  const environment = ctx.env.ENVIRONMENT;
  if (environment === 'development') return origin.startsWith('http://') ? origin : null;
  return appOfOrigin(origin, environment) ? origin : null;
}

export async function mintEmbedTicket(ctx: WorkbenchContext): Promise<Response> {
  const bearer = bearerOf(ctx.request);
  if (!bearer) return signInRequired();
  // The person's own access or guest token only: an API token, a workbench session or a share code mints nothing.
  if (hasApiTokenPrefix(bearer) || bearer.startsWith('lvw_')) return tokenRequired();
  const person = await bearerPerson(bearer, ctx.env, ctx.auth, ctx.now);
  if (!person) return signInRequired();
  const personId = person.kind === 'account' ? person.userId : person.guestId;
  const refused = (reason: string, res: Response) => {
    console.warn('[workbench] embed-refused', { reason, kind: person.kind });
    return res;
  };
  if (await embedLimited(ctx, personId)) return refused('rate_limited', rateLimited());
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await ctx.request.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return badRequest('expected a JSON object');
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest('invalid json');
  }
  if (!isTarget(body.target)) return refused('invalid_value', invalidValue('invalid target'));
  if (!isId(body.itemId)) return refused('invalid_value', invalidValue('invalid itemId'));
  const origin = hostOrigin(ctx, body.origin);
  if (!origin) return refused('invalid_origin', fail(400, 'invalid_origin'));
  const app = body.target;
  const itemId = body.itemId;
  const { env, now } = ctx;

  const teams =
    person.kind === 'account' ? (await teamsClaim(env.AUTH_DB, personId)).map((t) => t.id) : [];
  const access = await ownerItemAccess(env, {
    app,
    noun: dialectOf(app).noun,
    personId,
    teams,
    itemId,
  });
  if (!access.ok) return refused('access', fail(access.status, access.error));

  const store = workbenchStoreOf(env.WORKBENCH!, personId);
  const pairing = await store.embedPairing({ personId, app, origin, now });
  const minted = await store.mintTicket({
    personId,
    pairingId: pairing.id,
    reach: { scope: 'item', itemId, folderId: null },
    tabId: null,
    role: 'view',
    now,
    expiresAt: now + WORKBENCH_TICKET_TTL_MS,
  });
  if (!minted) return refused('unpaired', fail(409, 'pairing_changed'));
  console.info('[workbench] embed-ticket-minted', {
    app,
    itemId,
    originHost: new URL(origin).hostname,
    kind: person.kind,
  });
  return json(
    {
      ticket: minted.ticket,
      path: `/embed/workbench?d=${encodeURIComponent(itemId)}`,
      expiresAt: minted.expiresAt,
    },
    201,
  );
}
