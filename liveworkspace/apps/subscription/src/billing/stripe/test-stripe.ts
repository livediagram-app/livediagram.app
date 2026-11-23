// A Stripe for the tests: the API calls the provider makes, answered from what a test arranges, each call recorded
// with its form fields. Not a `.test.ts` file, so vitest doesn't collect it.

import type { OwnerScope } from '@liveworkspace/subscription';
import type { Env } from '../../env';
import type { StripeSubscription, StripeSubscriptionStatus } from './api';
import { signatureOf } from './signature';

export const STRIPE_ENV: Pick<
  Env,
  | 'BILLING_PROVIDER'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRICE_PRO'
  | 'STRIPE_PRICE_TEAM'
> = {
  BILLING_PROVIDER: 'stripe',
  STRIPE_SECRET_KEY: 'rk_test_1',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_1',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_TEAM: 'price_team',
};

export type StripeCallRecord = {
  method: string;
  path: string;
  form: URLSearchParams;
  headers: Headers;
};

type Session = {
  id: string;
  url: string;
  status: 'open' | 'complete' | 'expired';
  subscription: string | null;
};

/** A subscription as Stripe answers it, for `owner`, active for the month from `now` unless told otherwise. */
export function stripeSub(
  owner: OwnerScope,
  now: number,
  patch: Partial<Omit<StripeSubscription, 'items'>> & {
    quantity?: number;
    price?: string;
    periodStart?: number;
    periodEnd?: number;
    status?: StripeSubscriptionStatus;
  } = {},
): StripeSubscription {
  const { quantity, price, periodStart, periodEnd, ...rest } = patch;
  const team = owner.startsWith('t:');
  const seconds = Math.floor(now / 1000);
  return {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    currency: 'gbp',
    cancel_at_period_end: false,
    cancel_at: null,
    ended_at: null,
    billing_cycle_anchor: seconds,
    created: seconds,
    metadata: { owner, by: 'user_ada', unit_amount: team ? '6' : '8' },
    items: {
      data: [
        {
          id: 'si_1',
          quantity: quantity ?? (team ? 3 : 1),
          price: { id: price ?? (team ? 'price_team' : 'price_pro') },
          current_period_start: Math.floor((periodStart ?? now) / 1000),
          current_period_end: Math.floor((periodEnd ?? now + 30 * 86_400_000) / 1000),
        },
      ],
    },
    ...rest,
  };
}

export function fakeStripe() {
  const state = {
    subscriptions: new Map<string, StripeSubscription>(),
    sessions: new Map<string, Session>(),
    calls: [] as StripeCallRecord[],
    down: false,
  };
  let made = 0;
  const reply = (body: unknown, status = 200) => Response.json(body, { status });
  const missing = () =>
    reply({ error: { code: 'resource_missing', message: 'No such object' } }, 404);

  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname !== 'api.stripe.com') throw new Error(`unexpected fetch ${url.href}`);
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/v1/, '');
    const form =
      method === 'GET' ? url.searchParams : new URLSearchParams(String(init?.body ?? ''));
    state.calls.push({ method, path, form, headers: new Headers(init?.headers) });
    if (state.down) return reply({ error: { message: 'down' } }, 500);
    const [, kind, id, action] = path.split('/');

    if (kind === 'checkout' && id === 'sessions' && method === 'POST' && !action) {
      made++;
      const session: Session = {
        id: `cs_${made}`,
        url: `https://checkout.stripe.com/c/pay/cs_${made}`,
        status: 'open',
        subscription: null,
      };
      state.sessions.set(session.id, session);
      return reply({ object: 'checkout.session', ...session });
    }
    if (kind === 'checkout' && id === 'sessions') {
      const [, , , sessionId, verb] = path.split('/');
      const session = state.sessions.get(sessionId ?? '');
      if (!session) return missing();
      if (verb === 'expire') {
        if (session.status !== 'open')
          return reply({ error: { code: 'checkout_session_not_open', message: 'not open' } }, 400);
        session.status = 'expired';
      }
      return reply({ object: 'checkout.session', ...session });
    }
    if (kind === 'billing_portal' && id === 'sessions' && method === 'POST') {
      return reply({ url: `https://billing.stripe.com/p/session/${form.get('customer')}` });
    }
    if (kind === 'subscriptions' && id) {
      const sub = state.subscriptions.get(decodeURIComponent(id));
      if (!sub) return missing();
      if (method === 'POST') {
        const quantity = form.get('items[0][quantity]');
        if (quantity) sub.items.data[0]!.quantity = Number(quantity);
      }
      if (method === 'DELETE') {
        sub.status = 'canceled';
        sub.ended_at = Math.floor(Date.now() / 1000);
      }
      return reply(sub);
    }
    return reply({ error: { message: `no fake for ${method} ${path}` } }, 400);
  };

  return {
    state,
    fetcher,
    /** Puts a subscription at Stripe. */
    put(sub: StripeSubscription) {
      state.subscriptions.set(sub.id, sub);
      return sub;
    },
    /** A checkout paid at Stripe, making `subscription`. */
    pay(sessionId: string, subscription: string) {
      const session = state.sessions.get(sessionId)!;
      session.status = 'complete';
      session.subscription = subscription;
    },
    callsTo(method: string, prefix: string) {
      return state.calls.filter((call) => call.method === method && call.path.startsWith(prefix));
    },
  };
}

/** A webhook request as Stripe sends it, signed with the test secret at `now`. */
export async function webhookInit(
  event: { type: string; object: Record<string, unknown>; id?: string },
  now: number,
  secret = STRIPE_ENV.STRIPE_WEBHOOK_SECRET!,
): Promise<RequestInit> {
  const body = JSON.stringify({
    id: event.id ?? 'evt_1',
    object: 'event',
    type: event.type,
    created: Math.floor(now / 1000),
    data: { object: event.object },
  });
  const t = Math.floor(now / 1000);
  return {
    method: 'POST',
    body,
    headers: { 'Stripe-Signature': `t=${t},v1=${await signatureOf(secret, t, body)}` },
  };
}
