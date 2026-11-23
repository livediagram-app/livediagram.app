// The browser routes (subscription.md "The subscription Worker"): the prices anyone may read, and what a signed-in
// person reads and starts with their account's access token: their own subscription, usage and teams, what they may
// know of an item's owner, a checkout and the billing portal. A guest or a signed-out caller is answered 401.

import {
  isLimitKey,
  isOwnerScope,
  parseOwnerScope,
  personScope,
  priceList,
  PRICES,
  seatsFor,
  teamScope,
  TEAM_REQUEST_NOTE_MAX,
  TEAM_SEATS_MIN,
  type MeResponse,
  type OwnerScope,
  type OwnerView,
  type PricesResponse,
  type SubscriptionSummary,
  type TeamRequestResponse,
  type TeamSubscription,
} from '@liveworkspace/subscription';
import type { TeamClaim } from '@liveworkspace/auth-client';
import { callerOf, type Caller } from './account';
import { billingProvider, providerName } from './billing/provider';
import { ME_TEAMS_MAX, PRICES_MAX_AGE_SECONDS } from './config';
import { currencyOf } from './currency';
import type { Env } from './env';
import { badRequest, json, methodNotAllowed, notFound, readObject, refusal } from './http';
import { mediaUsage, withMediaUsage } from './media-usage';
import { readOwners } from './meters/usage';
import { paidTierOf } from './meters/limits';
import { safeReturnTo } from './origins';
import { withinBudget } from './rate';
import { accountName, teamMemberNow, teamMembers, teamsMembers } from './seats';
import { teamBillingRefusal } from './team-billing';
import { recordTeamRequest, teamRequestsFrom, teamRequestStatements } from './team-requests';
import { entitlementAt, summaryAt, tierAt } from './subscriptions/entitlement';
import { isLive, type SubscriptionRow } from './subscriptions/state';
import { dismissEnded, readSubscription } from './subscriptions/store';

function prices(request: Request, env: Env, url: URL): Response {
  const body: PricesResponse = { prices: priceList(currencyOf(request, env, url)) };
  // The answer follows the visitor's country, which no header names: a browser may keep it, a shared cache never.
  return json(body, { headers: { 'Cache-Control': `private, max-age=${PRICES_MAX_AGE_SECONDS}` } });
}

/**
 * Each team's members, as `/me` shows them, at the cost of at most ONE call to accounts however many teams. A
 * subscribed team's are the seats its row holds (the sweep keeps them in step daily). Every other team's are its
 * joined members as accounts has them: remembered briefly, else asked for together (`teamsMembers`), so a member who
 * joined a moment ago is counted on the next read. A team accounts did not answer for is absent.
 */
async function membersOf(
  env: Env,
  teams: readonly TeamClaim[],
  subscriptions: ReadonlyMap<OwnerScope, SubscriptionRow>,
  now: number,
): Promise<Map<string, number>> {
  const members = new Map<string, number>();
  const unsubscribed: string[] = [];
  for (const team of teams) {
    const row = subscriptions.get(teamScope(team.id));
    if (row && isLive(row, now)) members.set(team.id, row.seats);
    else unsubscribed.push(team.id);
  }
  if (unsubscribed.length === 0) return members;
  for (const [id, count] of await teamsMembers(env, unsubscribed, now)) members.set(id, count);
  return members;
}

/**
 * A team's subscription as a member who is not one of its admins sees it: the tier, its state, seats, limits and
 * how much is used. What it costs, and when it renews or lapses, are its admins'.
 */
function forMember(summary: SubscriptionSummary): SubscriptionSummary {
  // When the team's paid tier ended is its billing too: a member is told only that it is Free now.
  const { endedAt: _endedAt, endedTier: _endedTier, ...rest } = summary;
  return { ...rest, currency: null, amount: null, periodEnd: null, graceEnds: null };
}

async function me(request: Request, env: Env, url: URL, caller: Caller): Promise<Response> {
  const now = Date.now();
  const personal = personScope(caller.userId);
  const teams = caller.teams.slice(0, ME_TEAMS_MAX);
  const owners = [personal, ...teams.map((team) => teamScope(team.id))];
  const scopesOf = (role: TeamClaim['role']) =>
    teams.filter((team) => team.role === role).map((team) => teamScope(team.id));
  const [read, held] = await Promise.all([
    // Who asked for Pro for Teams rides in the same batch as the owners' rows.
    readOwners(
      env.SUBSCRIPTION_DB,
      owners,
      now,
      teamRequestStatements(
        env.SUBSCRIPTION_DB,
        caller.userId,
        { admin: scopesOf('admin'), member: scopesOf('member') },
        now,
      ),
    ),
    mediaUsage(env, owners),
  ]);
  const requests = teamRequestsFrom(read.beside);
  const members = await membersOf(env, teams, read.subscriptions, now);
  const summary = (owner: OwnerScope, count?: number) =>
    summaryAt(
      owner,
      read.subscriptions.get(owner) ?? null,
      withMediaUsage(read.usage.get(owner) ?? {}, owner, held),
      now,
      count,
    );
  const mine = read.subscriptions.get(personal);
  const body: MeResponse = {
    personal: summary(personal),
    teams: teams.map((team): TeamSubscription => {
      const owner = teamScope(team.id);
      // Unknown (no credentials, accounts out of reach, not theirs to be asked for): the fewest a team is.
      const count = members.get(team.id) ?? TEAM_SEATS_MIN;
      const shown = summary(owner, count);
      // Who asked for Pro for Teams is for the admins of a team still on Free; a member is told only that they
      // themself asked today.
      const asked = shown.tier === 'free' ? requests.byTeam.get(owner) : undefined;
      const mine = shown.tier === 'free' ? requests.mine.get(owner) : undefined;
      return {
        ...(team.role === 'admin' ? shown : forMember(shown)),
        teamId: team.id,
        name: team.name,
        role: team.role,
        members: count,
        ...(asked ? { requests: asked } : {}),
        ...(mine === undefined ? {} : { askedAt: mine }),
      };
    }),
    // A subscriber is shown the currency their subscription was taken in, wherever they are.
    prices: priceList(mine && isLive(mine, now) ? mine.currency : currencyOf(request, env, url)),
    provider: providerName(env),
  };
  return json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/** What a caller is to an owner: the person themself or a team's admin runs its billing, a team's other members
 *  ask an admin, and anyone else only collaborates on something of the owner's. */
type Standing = 'billing' | 'member' | 'other';

function standingOf(caller: Caller, owner: OwnerScope): Standing {
  const parsed = parseOwnerScope(owner);
  if (parsed?.kind === 'person') return parsed.id === caller.userId ? 'billing' : 'other';
  const team = caller.teams.find((claim) => claim.id === parsed?.id);
  if (!team) return 'other';
  return team.role === 'admin' ? 'billing' : 'member';
}

function actionOf(standing: Standing, paid: boolean): OwnerView['action'] {
  if (standing === 'billing') return paid ? 'manage' : 'upgrade';
  return standing === 'member' ? 'ask_admin' : 'none';
}

async function ownerView(env: Env, url: URL, caller: Caller): Promise<Response> {
  const owner = url.searchParams.get('scope');
  if (!isOwnerScope(owner)) return badRequest();
  const standing = standingOf(caller, owner);
  const headers = { 'Cache-Control': 'no-store' };
  // Someone outside the owner learns nothing of its subscription, and no row is read for them.
  if (standing === 'other') {
    const outside: OwnerView = { owner, tier: null, limits: null, action: 'none' };
    return json(outside, { headers });
  }
  const now = Date.now();
  const entitlement = entitlementAt(owner, await readSubscription(env.SUBSCRIPTION_DB, owner), now);
  const body: OwnerView = {
    owner,
    tier: entitlement.tier,
    limits: entitlement.limits,
    action: actionOf(standing, entitlement.tier !== 'free'),
  };
  return json(body, { headers });
}

/** The name a checkout or the portal shows for an owner: the team's, or the person's own name as accounts shows
 *  it, falling back to their email when they have set none or accounts cannot say. */
async function ownerNameOf(env: Env, caller: Caller, owner: OwnerScope): Promise<string> {
  const parsed = parseOwnerScope(owner);
  if (parsed?.kind === 'team')
    return caller.teams.find((team) => team.id === parsed.id)?.name ?? 'Team';
  return (await accountName(env, caller.userId)) ?? caller.email ?? 'Your account';
}

type Billing = { owner: OwnerScope; returnTo: string; row: SubscriptionRow | null; now: number };

/** What checkout and the portal both check first, or the refusal: a well-formed owner the caller runs the billing
 *  of (by their token, and for a team by accounts' word this moment), somewhere safe to come back to, and a budget
 *  not yet spent. */
async function billingRequest(
  request: Request,
  env: Env,
  caller: Caller,
): Promise<Billing | Response> {
  const body = await readObject(request);
  const owner = body?.owner;
  if (!isOwnerScope(owner)) return badRequest();
  if (standingOf(caller, owner) !== 'billing') return refusal('not_team_admin');
  const returnTo = safeReturnTo(env, body?.returnTo);
  if (!returnTo) return badRequest();
  if (!(await withinBudget(env, `account:${caller.userId}`))) return refusal('rate_limited');
  const now = Date.now();
  const unconfirmed = await teamBillingRefusal(env, owner, caller.userId, now);
  if (unconfirmed) return unconfirmed;
  return { owner, returnTo, row: await readSubscription(env.SUBSCRIPTION_DB, owner), now };
}

async function checkout(request: Request, env: Env, url: URL, caller: Caller): Promise<Response> {
  const asked = await billingRequest(request, env, caller);
  if (asked instanceof Response) return asked;
  const { owner, returnTo, row, now } = asked;
  if (tierAt(owner, row, now) !== 'free') return refusal('already_subscribed');
  const provider = billingProvider(env);
  if (!provider) return refusal('billing_unavailable');
  const tier = paidTierOf(owner);
  const currency = currencyOf(request, env, url);
  const team = tier === 'team' ? parseOwnerScope(owner) : null;
  const seats = team ? seatsFor((await teamMembers(env, team.id, now)) ?? 0) : 1;
  const ownerName = await ownerNameOf(env, caller, owner);
  const unitAmount = PRICES[currency][tier];
  const start = {
    owner,
    ownerName,
    tier,
    seats,
    currency,
    unitAmount,
    returnTo,
    by: caller.userId,
  };
  const started = await provided(() => provider.startCheckout(start, now));
  return typeof started === 'string' ? refusal(started) : json(started);
}

/** A provider's call, with a failure it can't recover from (Stripe out of reach or refusing) said as billing being
 *  unavailable for now, and logged, never as a crash. */
async function provided<T>(call: () => Promise<T>): Promise<T | 'billing_unavailable'> {
  try {
    return await call();
  } catch (error) {
    console.error('[subscription] the billing provider failed', { error: String(error) });
    return 'billing_unavailable';
  }
}

async function portal(request: Request, env: Env, _url: URL, caller: Caller): Promise<Response> {
  const asked = await billingRequest(request, env, caller);
  if (asked instanceof Response) return asked;
  const { owner, returnTo, row, now } = asked;
  if (tierAt(owner, row, now) === 'free') return refusal('not_subscribed');
  const provider = billingProvider(env);
  if (!provider) return refusal('billing_unavailable');
  const ownerName = await ownerNameOf(env, caller, owner);
  const opened = await provided(() =>
    provider.openPortal({ owner, ownerName, returnTo, by: caller.userId }, now),
  );
  return typeof opened === 'string' ? refusal(opened) : json(opened);
}

/**
 * A team's member asks its admins for Pro for Teams (subscription.md "Ask an Admin"), with the limit that prompted it
 * and a note of their own. The request is kept for the admins to read in Settings: nothing is sent, and the member is
 * told nothing of who the admins are. Only someone
 * accounts says is a joined member of the team at this moment may ask, once a team a day, and never of a team that
 * already subscribes.
 */
async function teamRequest(
  request: Request,
  env: Env,
  _url: URL,
  caller: Caller,
): Promise<Response> {
  const body = await readObject(request);
  const owner = body?.owner;
  const team = isOwnerScope(owner) ? parseOwnerScope(owner) : null;
  const limit = body?.limit ?? null;
  const note = body?.note ?? null;
  if (!isOwnerScope(owner) || team?.kind !== 'team') return badRequest();
  if (limit !== null && !isLimitKey(limit)) return badRequest();
  if (note !== null && (typeof note !== 'string' || note.length > TEAM_REQUEST_NOTE_MAX))
    return badRequest();
  if (!(await withinBudget(env, `account:${caller.userId}`))) return refusal('rate_limited');
  const now = Date.now();
  const standing = await teamMemberNow(env, team.id, caller.userId, now);
  if (standing === 'unknown') return refusal('accounts_unavailable', { 'Retry-After': '5' });
  if (standing === 'not_member') return refusal('not_team_member');
  const db = env.SUBSCRIPTION_DB;
  if (tierAt(owner, await readSubscription(db, owner), now) !== 'free')
    return refusal('already_subscribed');
  const answer: TeamRequestResponse = await recordTeamRequest(
    db,
    { team: owner, account: caller.userId, name: standing.name, limit, note: note?.trim() || null },
    now,
  );
  return json(answer, { headers: { 'Cache-Control': 'no-store' } });
}

/** The owner has read "You're Back on Free": it is not said again, in this browser or another. For the person
 *  themself or a team's admin; anyone else is answered as if there were nothing to dismiss. */
async function endedDismiss(
  request: Request,
  env: Env,
  _url: URL,
  caller: Caller,
): Promise<Response> {
  const owner = (await readObject(request))?.owner;
  if (!isOwnerScope(owner)) return badRequest();
  if (!(await withinBudget(env, `account:${caller.userId}`))) return refusal('rate_limited');
  if (standingOf(caller, owner) === 'billing')
    await dismissEnded(env.SUBSCRIPTION_DB, owner, Date.now());
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

type SignedIn = (request: Request, env: Env, url: URL, caller: Caller) => Promise<Response>;

const SIGNED_IN: Record<string, { method: 'GET' | 'POST'; run: SignedIn }> = {
  '/me': { method: 'GET', run: me },
  '/owner': { method: 'GET', run: (_request, env, url, caller) => ownerView(env, url, caller) },
  '/checkout': { method: 'POST', run: checkout },
  '/portal': { method: 'POST', run: portal },
  '/team-request': { method: 'POST', run: teamRequest },
  '/ended/dismiss': { method: 'POST', run: endedDismiss },
};

export async function handleBrowser(
  request: Request,
  env: Env,
  url: URL,
  path: string,
): Promise<Response> {
  if (path === '/prices') {
    return request.method === 'GET' ? prices(request, env, url) : methodNotAllowed('GET');
  }
  const route = Object.hasOwn(SIGNED_IN, path) ? SIGNED_IN[path] : undefined;
  if (!route) return notFound();
  if (request.method !== route.method) return methodNotAllowed(route.method);
  const caller = await callerOf(request, env);
  if (!caller) return refusal('unauthorised');
  return route.run(request, env, url, caller);
}
