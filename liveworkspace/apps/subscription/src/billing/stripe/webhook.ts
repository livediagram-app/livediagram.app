// Stripe's webhooks (`POST /api/subscription/stripe/webhook`, subscription.md "Stripe"). An event only says which
// subscription changed: its signature is checked, the subscription is read fresh from Stripe and the owner's row
// written from it (./sync.ts). Answered 200 once written or when there is nothing to write, and 500 when Stripe could
// not be read or the write failed, so Stripe sends it again. Server to server: no CORS, no account.

import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { STRIPE_WEBHOOK_MAX_BYTES } from '../../config';
import type { Env } from '../../env';
import { json, methodNotAllowed, notFound } from '../../http';
import { stripeApi, type StripeEvent } from './api';
import { STRIPE, stripeConfig } from './config';
import { isSignedByStripe } from './signature';
import { syncSubscription } from './sync';

const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]{1,250}$/;

const idOf = (value: unknown): string | null =>
  typeof value === 'string' && SUBSCRIPTION_ID.test(value) ? value : null;

/** The subscription an event is about, or null for an event that names none (a one-off payment, another kind). */
export function subscriptionOfEvent(event: StripeEvent): string | null {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed':
      return idOf(object.subscription);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return idOf(object.id);
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const parent = object.parent as
        { subscription_details?: { subscription?: unknown } } | undefined;
      return idOf(parent?.subscription_details?.subscription) ?? idOf(object.subscription);
    }
    default:
      return null;
  }
}

export async function handleStripeWebhook(
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const config = env.BILLING_PROVIDER?.trim().toLowerCase() === STRIPE ? stripeConfig(env) : null;
  if (!config) return notFound();
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const bytes = request.body ? await readCappedBody(request.body, STRIPE_WEBHOOK_MAX_BYTES) : null;
  if (!bytes) return json({ error: 'bad_request' }, { status: 400 });
  const payload = new TextDecoder().decode(bytes);
  const now = Date.now();
  if (
    !(await isSignedByStripe(
      config.webhookSecret,
      request.headers.get('Stripe-Signature'),
      payload,
      now,
    ))
  ) {
    return json({ error: 'bad_signature' }, { status: 400 });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json({ error: 'bad_request' }, { status: 400 });
  }
  const subscription = subscriptionOfEvent(event);
  if (!subscription) return json({ received: true });
  try {
    const synced = await syncSubscription(
      env.SUBSCRIPTION_DB,
      config,
      stripeApi(config.secretKey, fetcher),
      subscription,
      now,
    );
    return json({ received: true, synced: typeof synced === 'string' ? synced : 'written' });
  } catch (error) {
    console.error('[subscription] a Stripe webhook could not be written', {
      type: event.type,
      error: String(error),
    });
    return json({ error: 'not_written' }, { status: 500 });
  }
}
