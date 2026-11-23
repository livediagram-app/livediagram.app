// liveworkspace's subscription service (liveworkspace/docs/specs/019-subscription/subscription.md): the one place a
// subscription is read or written, on liveworkspace.app/api/subscription. A person's browser reads its own
// subscription and starts a checkout with the account's access token; an app's Worker asks for an owner's
// entitlement, spends from a meter and reports gauges with that app's key. With PRO_ENABLED off there is no
// subscription service: every route answers 404 and the cron does nothing.

import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { under } from '@liveworkspace/index-app/worker-http';
import { handleMock } from './billing/mock-routes';
import { handleStripeWebhook } from './billing/stripe/webhook';
import { handleBrowser } from './browser-routes';
import { API_PATH } from './config';
import { readDevLimits } from './dev-limits';
import { subscriptionEnabled, type Env } from './env';
import { json, notFound, preflight, withCors } from './http';
import { handleInternal } from './internal-routes';
import { sweepSubscriptions } from './sweep';

// Internal routes and Stripe's webhook are server to server: no browser is ever let in, so no CORS.
const isInternal = (pathname: string): boolean =>
  under(pathname, API_PATH) &&
  (under(pathname.slice(API_PATH.length), '/internal') ||
    pathname.slice(API_PATH.length) === '/stripe/webhook');

// The route words a failure is logged under (`POST /internal/spend`, `GET /mock/checkout`), never an id.
const ROUTE_WORDS = new Set([
  'internal',
  'entitlement',
  'spend',
  'gauge',
  'item-count',
  'prices',
  'me',
  'owner',
  'checkout',
  'portal',
  'mock',
  'stripe',
  'webhook',
]);

function routeLabel(request: Request): string {
  const words = new URL(request.url).pathname
    .slice(API_PATH.length)
    .split('/')
    .filter((word) => ROUTE_WORDS.has(word));
  return `${request.method} /${words.join('/')}`;
}

async function serve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
  // Switched off, there is no subscription service to answer for: not even a preflight.
  if (!subscriptionEnabled(env)) return notFound();
  readDevLimits(env);
  const path = url.pathname.slice(API_PATH.length);
  if (under(path, '/internal')) return handleInternal(request, env, path.slice('/internal'.length));
  // Stripe's, server to server: no CORS.
  if (path === '/stripe/webhook') return handleStripeWebhook(request, env);
  if (request.method === 'OPTIONS') return preflight(request, env);
  if (under(path, '/mock')) {
    return withCors(request, env, await handleMock(request, env, path.slice('/mock'.length)));
  }
  return withCors(request, env, await handleBrowser(request, env, url, path));
}

const worker = {
  // One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request
  // fails"), its answer with the CORS a browser route's answer has.
  fetch(request: Request, env: Env): Promise<Response> {
    return guardRequest(
      () => serve(request, env),
      () => ({
        route: routeLabel(request),
        json: (body, init) => {
          const res = json(body, init);
          return isInternal(new URL(request.url).pathname) ? res : withCors(request, env, res);
        },
      }),
    );
  },
  // The cron (hourly): the sweep marks lapsed subscriptions ended and drops what nobody will read again
  // (src/sweep.ts). Switched off, there is nothing to do.
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    if (!subscriptionEnabled(env)) return;
    ctx.waitUntil(
      sweepSubscriptions(env).catch((error: unknown) =>
        console.error('[subscription] sweep failed', { error: String(error) }),
      ),
    );
  },
};

export default worker;
