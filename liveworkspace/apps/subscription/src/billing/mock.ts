// The mock billing provider (subscription.md "Billing"): it keeps everything in this Worker's database and takes no
// card. Its checkout and portal are pages of the site (`/subscription/checkout`, `/subscription/billing`), which
// read and act on a session here by its id. The id is the secret, as a hosted checkout's link is.

import type { Currency, OwnerScope, PaidTier } from '@liveworkspace/subscription';
import { MOCK_CHECKOUT_TTL_MS, MOCK_PORTAL_TTL_MS } from '../config';
import { siteOrigin, type Env } from '../env';
import type { BillingProvider } from './provider';

export const MOCK = 'mock';

export type MockCheckoutRow = {
  id: string;
  owner: OwnerScope;
  owner_name: string;
  tier: PaidTier;
  seats: number;
  currency: Currency;
  unit_amount: number;
  return_to: string;
  created_by: string;
  created_at: number;
  expires_at: number;
};

export type MockPortalRow = {
  id: string;
  owner: OwnerScope;
  owner_name: string;
  return_to: string;
  created_by: string;
  created_at: number;
  expires_at: number;
};

/** 32 random bytes as base64url: 43 characters nobody can guess. */
export function sessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

export function isSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/** A checkout that has not expired, or null. */
export function readMockCheckout(
  db: D1Database,
  id: string,
  now: number,
): Promise<MockCheckoutRow | null> {
  return db
    .prepare('SELECT * FROM mock_checkout_sessions WHERE id = ? AND expires_at > ?')
    .bind(id, now)
    .first<MockCheckoutRow>();
}

/** The statement that ends a checkout, for a batch or on its own. */
export function endMockCheckout(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare('DELETE FROM mock_checkout_sessions WHERE id = ?').bind(id);
}

/** A portal session that has not expired, or null. */
export function readMockPortal(
  db: D1Database,
  id: string,
  now: number,
): Promise<MockPortalRow | null> {
  return db
    .prepare('SELECT * FROM mock_portal_sessions WHERE id = ? AND expires_at > ?')
    .bind(id, now)
    .first<MockPortalRow>();
}

export function mockProvider(env: Env): BillingProvider {
  const db = env.SUBSCRIPTION_DB;
  const site = siteOrigin(env);
  return {
    name: MOCK,
    async startCheckout(start, now) {
      const id = sessionId();
      await db
        .prepare(
          `INSERT INTO mock_checkout_sessions
             (id, owner, owner_name, tier, seats, currency, unit_amount, return_to, created_by, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          start.owner,
          start.ownerName,
          start.tier,
          start.seats,
          start.currency,
          start.unitAmount,
          start.returnTo,
          start.by,
          now,
          now + MOCK_CHECKOUT_TTL_MS,
        )
        .run();
      return { url: `${site}/subscription/checkout?session=${id}` };
    },
    async openPortal(open, now) {
      const id = sessionId();
      await db
        .prepare(
          `INSERT INTO mock_portal_sessions (id, owner, owner_name, return_to, created_by, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, open.owner, open.ownerName, open.returnTo, open.by, now, now + MOCK_PORTAL_TTL_MS)
        .run();
      return { url: `${site}/subscription/billing?session=${id}` };
    },
  };
}
