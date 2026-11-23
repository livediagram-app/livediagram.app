// The mock provider's pages talk to these (`/api/subscription/mock/*`, subscription.md "Billing"). No account is
// asked for: whoever holds a session's id holds the session, as with a hosted checkout's link. They exist only with
// the mock provider, which never exists in production (`isMock`), and each network has a budget.

import {
  MOCK_CHECKOUT_ACTIONS,
  MOCK_PORTAL_ACTIONS,
  parseOwnerScope,
  type MockCheckout,
  type MockCheckoutAction,
  type MockPortal,
  type MockPortalAction,
  type RedirectResponse,
} from '@liveworkspace/subscription';
import type { Env } from '../env';
import { badRequest, json, methodNotAllowed, notFound, readObject, refusal } from '../http';
import { readOwners } from '../meters/usage';
import { networkKey, withinBudget } from '../rate';
import { teamMembers } from '../seats';
import { teamBillingRefusal } from '../team-billing';
import { clearTeamRequests } from '../team-requests';
import { summaryAt } from '../subscriptions/entitlement';
import {
  isLive,
  subscribed,
  type SubscriptionChange,
  type SubscriptionRow,
} from '../subscriptions/state';
import { applyChange, readSubscription, writeSubscriptionStatement } from '../subscriptions/store';
import {
  endMockCheckout,
  isSessionId,
  MOCK,
  readMockCheckout,
  readMockPortal,
  type MockCheckoutRow,
  type MockPortalRow,
} from './mock';
import { isMock } from './provider';

function checkoutView(row: MockCheckoutRow): MockCheckout {
  return {
    id: row.id,
    owner: row.owner,
    ownerName: row.owner_name,
    tier: row.tier,
    seats: row.seats,
    currency: row.currency,
    unitAmount: row.unit_amount,
    amount: row.unit_amount * row.seats,
    returnTo: row.return_to,
  };
}

async function actOnCheckout(
  request: Request,
  env: Env,
  session: MockCheckoutRow,
  now: number,
): Promise<Response> {
  const action = (await readObject(request))?.action;
  if (!MOCK_CHECKOUT_ACTIONS.some((known) => known === action)) return badRequest();
  const db = env.SUBSCRIPTION_DB;
  const back: RedirectResponse = { url: session.return_to };
  if ((action as MockCheckoutAction) === 'cancel') {
    await endMockCheckout(db, session.id).run();
    return json(back);
  }
  // The link was made by an admin of the team then: paying needs them to be one still.
  const demoted = await teamBillingRefusal(env, session.owner, session.created_by, now);
  if (demoted) return demoted;
  const held = await readSubscription(db, session.owner);
  if (held && isLive(held, now)) return refusal('already_subscribed');
  const row: SubscriptionRow = {
    ...subscribed(
      {
        owner: session.owner,
        tier: session.tier,
        seats: session.seats,
        currency: session.currency,
        unitAmount: session.unit_amount,
        provider: MOCK,
        providerRef: session.id,
        subscribedBy: session.created_by,
      },
      now,
    ),
    // An owner that subscribed before keeps the day it first did.
    created_at: held?.created_at ?? now,
  };
  // Paid and the link spent together, or neither.
  // A team that subscribes has answered whoever asked for it.
  await db.batch([
    writeSubscriptionStatement(db, row),
    endMockCheckout(db, session.id),
    clearTeamRequests(db, session.owner),
  ]);
  return json(back);
}

async function portalView(
  env: Env,
  session: MockPortalRow,
  now: number,
  known?: SubscriptionRow,
): Promise<MockPortal> {
  const db = env.SUBSCRIPTION_DB;
  const read = await readOwners(db, [session.owner], now);
  const row = known ?? read.subscriptions.get(session.owner) ?? null;
  const owner = parseOwnerScope(session.owner);
  const counted = owner?.kind === 'team' ? await teamMembers(env, owner.id, now) : null;
  const members = owner?.kind === 'team' ? (counted ?? row?.seats ?? null) : null;
  return {
    id: session.id,
    ownerName: session.owner_name,
    subscription: summaryAt(
      session.owner,
      row,
      read.usage.get(session.owner) ?? {},
      now,
      members ?? undefined,
    ),
    members,
    returnTo: session.return_to,
  };
}

/** What each of the portal's buttons reports. `set_seats` carries the seats. */
function changeOf(action: MockPortalAction, seats: unknown): SubscriptionChange | null {
  switch (action) {
    case 'cancel':
      return { kind: 'cancel' };
    case 'resume':
      return { kind: 'resume' };
    case 'fail_payment':
      return { kind: 'payment_failed' };
    case 'recover_payment':
      return { kind: 'payment_recovered' };
    case 'end_grace':
      return { kind: 'grace_ended' };
    case 'end_period':
      return { kind: 'period_ended' };
    case 'renew':
      return { kind: 'renewed' };
    case 'set_seats':
      return typeof seats === 'number' ? { kind: 'seats', seats } : null;
  }
}

async function actOnPortal(
  request: Request,
  env: Env,
  session: MockPortalRow,
  now: number,
): Promise<Response> {
  const body = await readObject(request);
  const action = MOCK_PORTAL_ACTIONS.find((known) => known === body?.action);
  const change = action ? changeOf(action, body?.seats) : null;
  if (!change) return badRequest();
  // A portal link outlives a role: each change asks accounts whether whoever opened it still runs the team's billing.
  const demoted = await teamBillingRefusal(env, session.owner, session.created_by, now);
  if (demoted) return demoted;
  const next = await applyChange(env.SUBSCRIPTION_DB, session.owner, change, now);
  if (typeof next === 'string') return refusal(next);
  return json(await portalView(env, session, now, next));
}

export async function handleMock(request: Request, env: Env, path: string): Promise<Response> {
  if (!isMock(env)) return notFound();
  const [kind, id, ...rest] = path.split('/').filter(Boolean);
  if ((kind !== 'checkout' && kind !== 'portal') || !id || rest.length > 0) return notFound();
  if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed('GET, POST');
  if (!(await withinBudget(env, networkKey(request)))) return refusal('rate_limited');
  if (!isSessionId(id)) return notFound();
  const now = Date.now();
  const db = env.SUBSCRIPTION_DB;
  if (kind === 'checkout') {
    const session = await readMockCheckout(db, id, now);
    if (!session) return notFound();
    return request.method === 'GET'
      ? json(checkoutView(session))
      : actOnCheckout(request, env, session, now);
  }
  const session = await readMockPortal(db, id, now);
  if (!session) return notFound();
  return request.method === 'GET'
    ? json(await portalView(env, session, now))
    : actOnPortal(request, env, session, now);
}
