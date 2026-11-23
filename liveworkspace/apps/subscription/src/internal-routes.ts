// The internal routes (`/api/subscription/internal/*`, subscription.md "The subscription Worker"): what only an
// app's own Worker may ask. Each request names its app (X-Subscription-App) and carries that app's key as a bearer
// token. A browser can never call these: there is no CORS here, and no key in any page.

import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import {
  GAUGE_KEY_MAX,
  isGauge,
  isItemMeter,
  isOwnerScope,
  isSpendMeter,
  isSubscriptionApp,
  SPEND_AMOUNT_MAX,
  SUBSCRIPTION_APP_HEADER,
  type OwnerScope,
  type SubscriptionApp,
} from '@liveworkspace/subscription';
import { bearerOf } from './account';
import { ITEM_ID_MAX, REPORTED_MAX } from './config';
import { appKey, type Env } from './env';
import { badRequest, json, methodNotAllowed, notFound, readObject, refusal } from './http';
import { addToGauge, removeFromGauge } from './meters/gauges';
import { countItem } from './meters/item-usage';
import { spend } from './meters/spend';
import { entitlementAt } from './subscriptions/entitlement';
import { readSubscription } from './subscriptions/store';

/** The app this request speaks for, or null when it doesn't carry that app's key. */
export async function callerApp(request: Request, env: Env): Promise<SubscriptionApp | null> {
  const app = request.headers.get(SUBSCRIPTION_APP_HEADER);
  if (!isSubscriptionApp(app)) return null;
  const expected = appKey(env, app);
  const token = bearerOf(request);
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

const isWhole = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

type Body = Record<string, unknown> & { owner: OwnerScope };

async function entitlement(env: Env, body: Body, now: number): Promise<Response> {
  return json(
    entitlementAt(body.owner, await readSubscription(env.SUBSCRIPTION_DB, body.owner), now),
  );
}

async function spending(env: Env, body: Body, now: number): Promise<Response> {
  const { owner, meter, amount } = body;
  if (!isSpendMeter(meter) || !isWhole(amount, 1, SPEND_AMOUNT_MAX)) return badRequest();
  return json(await spend(env.SUBSCRIPTION_DB, owner, meter, amount, now));
}

async function gauging(env: Env, body: Body, now: number): Promise<Response> {
  const { owner, gauge, op, key } = body;
  if (!isGauge(gauge)) return badRequest();
  const db = env.SUBSCRIPTION_DB;
  if ((op !== 'add' && op !== 'remove') || !isText(key, GAUGE_KEY_MAX)) return badRequest();
  return json(await (op === 'add' ? addToGauge : removeFromGauge)(db, owner, gauge, key, now));
}

async function itemCount(env: Env, body: Body, now: number): Promise<Response> {
  const { owner, meter, item, used, adding } = body;
  if (!isItemMeter(meter) || !isText(item, ITEM_ID_MAX) || !isWhole(used, 0, REPORTED_MAX))
    return badRequest();
  if (adding !== undefined && typeof adding !== 'boolean') return badRequest();
  return json(
    await countItem(
      env.SUBSCRIPTION_DB,
      { owner, meter, item, used, adding: adding === true },
      now,
    ),
  );
}

const ROUTES: Record<string, (env: Env, body: Body, now: number) => Promise<Response>> = {
  '/entitlement': entitlement,
  '/spend': spending,
  '/gauge': gauging,
  '/item-count': itemCount,
};

export async function handleInternal(request: Request, env: Env, path: string): Promise<Response> {
  if (!(await callerApp(request, env))) return refusal('unauthorised');
  const route = Object.hasOwn(ROUTES, path) ? ROUTES[path] : undefined;
  if (!route) return notFound();
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const body = await readObject(request);
  if (!body || !isOwnerScope(body.owner)) return badRequest();
  return route(env, body as Body, Date.now());
}
