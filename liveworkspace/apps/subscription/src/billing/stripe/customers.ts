// `stripe_customers` (migrations/0001_subscription.sql): each owner's Stripe customer, made by its first checkout and kept,
// and the one checkout an owner may have open (subscription.md "Stripe", "Checkout").

import type { OwnerScope } from '@liveworkspace/subscription';

export type StripeCustomerRow = {
  owner: OwnerScope;
  customer: string | null;
  open_checkout: string | null;
  open_checkout_expires: number | null;
};

export function readStripeCustomer(
  db: D1Database,
  owner: OwnerScope,
): Promise<StripeCustomerRow | null> {
  return db
    .prepare(
      'SELECT owner, customer, open_checkout, open_checkout_expires FROM stripe_customers WHERE owner = ?',
    )
    .bind(owner)
    .first<StripeCustomerRow>();
}

/** The statement that keeps an owner's customer. A customer once kept is never replaced by another. */
export function rememberCustomer(
  db: D1Database,
  owner: OwnerScope,
  customer: string,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO stripe_customers (owner, customer, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (owner) DO UPDATE SET customer = COALESCE(stripe_customers.customer, excluded.customer),
         updated_at = excluded.updated_at`,
    )
    .bind(owner, customer, now);
}

/** Keeps the checkout now open for an owner, in place of any before it. */
export function rememberOpenCheckout(
  db: D1Database,
  owner: OwnerScope,
  session: string,
  expires: number,
  now: number,
): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO stripe_customers (owner, open_checkout, open_checkout_expires, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (owner) DO UPDATE SET open_checkout = excluded.open_checkout,
         open_checkout_expires = excluded.open_checkout_expires, updated_at = excluded.updated_at`,
    )
    .bind(owner, session, expires, now)
    .run();
}

/** The statement that forgets an owner's open checkout, once it is paid. */
export function clearOpenCheckout(
  db: D1Database,
  owner: OwnerScope,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      'UPDATE stripe_customers SET open_checkout = NULL, open_checkout_expires = NULL, updated_at = ? WHERE owner = ?',
    )
    .bind(now, owner);
}
