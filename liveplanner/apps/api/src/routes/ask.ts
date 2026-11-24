// Ask AI, `POST /api/ask` (liveworkspace/docs/specs/020-ask/ask.md "The route"): a question answered from the passages
// of the open plan its editor sent, on the person's own key (or the plan's team's) when one applies, else on
// built-in AI under its daily allowance and, with Pro on, an AI credit. The route itself is the platform's
// (@liveworkspace/ask/server); this file says who is calling, how accounts is asked for the key, where the allowance
// is counted, and how the index is asked who pays (020-ask "AI credits").
import { askCreditsOf, serveAsk, spendAsk } from '@liveworkspace/ask/server';
import { personAiKey } from '@liveworkspace/auth-client/ai-key';
import { accountCredentials } from '../auth/accounts';
import { CORS_HEADERS, methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';
import { resolvePlanGrant } from './plan-grant';

export async function handleAsk(ctx: RouteContext): Promise<Response> {
  if (ctx.segments.length !== 2) return notFound();
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  const { env } = ctx;
  return serveAsk({
    request: ctx.request,
    // A signed-in account (in the browser, a full API token or a workbench session); a guest is refused.
    accountId: ctx.verifiedUserId,
    itemWord: 'plan',
    // The caller's own key, or their team's: null for a token or a workbench session, which run on built-in AI.
    aiKey: (teamId) => personAiKey(accountCredentials(env), ctx, teamId),
    builtIn: env.AI ?? null,
    spend: (accountId, now) => spendAsk(env.PLAN_ROOM, accountId, now),
    // Null with Pro off: no grant is read and the subscription service is never asked.
    credits: askCreditsOf({
      env,
      app: 'liveplanner.app',
      rooms: env.PLAN_ROOM,
      teams: ctx.teams,
      grant: (itemId) => resolvePlanGrant(ctx, itemId),
    }),
    headers: CORS_HEADERS,
  });
}
