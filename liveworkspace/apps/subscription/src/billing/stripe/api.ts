// The few Stripe API calls the Stripe provider makes (subscription.md "Stripe"), over `fetch`: no SDK, so nothing
// but these calls ships in the Worker. Each is form-encoded, pinned to one API version and given up on after a
// moment, and a Stripe error is thrown as a StripeError with Stripe's own code.

import { STRIPE_API_VERSION, STRIPE_CALL_TIMEOUT_MS } from '../../config';

const STRIPE_API = 'https://api.stripe.com/v1';

export class StripeError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'StripeError';
  }
}

/** Form fields, Stripe's way: nested objects and arrays as `a[b][0][c]`. Undefined and null are left out. */
export type Fields = { [key: string]: FieldValue };
type FieldValue = string | number | boolean | null | undefined | Fields | FieldValue[];

export function formOf(fields: Fields): URLSearchParams {
  const form = new URLSearchParams();
  const add = (key: string, value: FieldValue): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((item, at) => add(`${key}[${at}]`, item));
    else if (typeof value === 'object')
      for (const [inner, item] of Object.entries(value)) add(`${key}[${inner}]`, item);
    else form.append(key, String(value));
  };
  for (const [key, value] of Object.entries(fields)) add(key, value);
  return form;
}

export type StripeCall = <T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  fields?: Fields,
  options?: { idempotencyKey?: string },
) => Promise<T>;

/** A caller of Stripe's API with this secret key. */
export function stripeApi(secretKey: string, fetcher: typeof fetch = fetch): StripeCall {
  return async <T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    fields: Fields = {},
    options: { idempotencyKey?: string } = {},
  ): Promise<T> => {
    const form = formOf(fields);
    const query = method === 'GET' && form.size > 0 ? `?${form}` : '';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
    };
    if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const response = await fetcher(`${STRIPE_API}${path}${query}`, {
      method,
      headers,
      body: method === 'POST' ? form : undefined,
      signal: AbortSignal.timeout(STRIPE_CALL_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    if (!response.ok) {
      throw new StripeError(
        response.status,
        body?.error?.code ?? null,
        // The resource's name only, never an id.
        `Stripe ${method} /${path.split('/')[1] ?? ''}: ${response.status} ${body?.error?.code ?? ''}`.trim(),
      );
    }
    return body as T;
  };
}

// --- The parts of Stripe's objects this Worker reads (API version STRIPE_API_VERSION) ---

export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type StripeSubscriptionItem = {
  id: string;
  quantity?: number;
  price: { id: string };
  current_period_start: number;
  current_period_end: number;
};

export type StripeSubscription = {
  id: string;
  object: 'subscription';
  status: StripeSubscriptionStatus;
  customer: string;
  currency: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  ended_at: number | null;
  billing_cycle_anchor: number;
  created: number;
  metadata: Record<string, string>;
  items: { data: StripeSubscriptionItem[] };
};

export type StripeCheckoutSession = {
  id: string;
  object: 'checkout.session';
  url: string | null;
  subscription: string | null;
  customer: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
};

export type StripeInvoice = {
  id: string;
  object: 'invoice';
  /** Older API versions. */
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
};

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: { id?: string; object?: string } & Record<string, unknown> };
};
