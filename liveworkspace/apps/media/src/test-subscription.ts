// The subscription service as these tests stand it in: a service binding that answers each owner's entitlement from
// a table of tiers and records the gauges reported to it. Owners not in the table are Free.
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import type { Env } from './env';

export type GaugeCall = { owner: string; gauge: string; value: number };

export function subscriptionStub(tiers: Record<string, Tier> = {}) {
  const asked: string[] = [];
  const gauges: GaugeCall[] = [];
  const fetcher = {
    fetch: async (input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        owner: OwnerScope;
        gauge?: string;
        value?: number;
      };
      if (input.endsWith('/internal/entitlement')) {
        asked.push(body.owner);
        const tier = tiers[body.owner] ?? 'free';
        return Response.json({ owner: body.owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      }
      if (input.endsWith('/internal/gauge')) {
        gauges.push({ owner: body.owner, gauge: body.gauge ?? '', value: body.value ?? 0 });
        return Response.json({ ok: true, used: body.value ?? 0, limit: null, tier: 'free' });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    },
  };
  /** The vars that turn Pro on against this stub. */
  const env: Pick<Env, 'PRO_ENABLED' | 'SUBSCRIPTION_KEY' | 'SUBSCRIPTION'> = {
    PRO_ENABLED: 'true',
    SUBSCRIPTION_KEY: 'sub-key',
    SUBSCRIPTION: fetcher,
  };
  return { env, asked, gauges };
}

// Every test names its own people, so one test's cached entitlement (60 s, per isolate) is never another's.
let serial = 0;
export const person = (label: string) => `user_${label}${++serial}`;
