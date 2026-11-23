// For tests in this package and in the packages that draw its parts: Pro on or off without a build flag, and the
// subscription service stood in by a `fetch` that answers as the Worker would.
import {
  limitsFor,
  priceList,
  type MeResponse,
  type OwnerScope,
  type OwnerView,
  type SubscriptionSummary,
  type TeamSubscription,
  type Tier,
} from '@liveworkspace/subscription';

export { forcePro as setProForTests } from './flag';

// The service as the tests stand it in: one person, their teams, and whatever each test says the answers are.

export const ME: OwnerScope = 'p:user_ada';
export const GARDEN: OwnerScope = 't:team_garden';
export const SIDE: OwnerScope = 't:team_side';

export function summary(
  owner: OwnerScope,
  tier: Tier,
  over: Partial<SubscriptionSummary> = {},
): SubscriptionSummary {
  const paid = tier !== 'free';
  return {
    owner,
    tier,
    state: paid ? 'active' : null,
    seats: 3,
    currency: paid ? 'GBP' : null,
    amount: paid ? (tier === 'team' ? 18 : 8) : null,
    periodEnd: paid ? Date.UTC(2026, 11, 20) : null,
    graceEnds: null,
    limits: limitsFor(tier, 3),
    usage: {},
    ...over,
  };
}

export function team(
  owner: OwnerScope,
  name: string,
  role: 'admin' | 'member',
  tier: Tier = 'free',
  over: Partial<TeamSubscription> = {},
): TeamSubscription {
  return { ...summary(owner, tier), teamId: owner.slice(2), name, role, members: 6, ...over };
}

export function meResponse(over: Partial<MeResponse> = {}): MeResponse {
  return {
    personal: summary(ME, 'free', {
      usage: { automationRuns: { used: 205 }, rules: { used: 6 } },
    }),
    teams: [],
    prices: priceList('GBP'),
    provider: 'mock',
    ...over,
  };
}

export function ownerView(
  owner: OwnerScope,
  action: OwnerView['action'],
  tier: Tier = 'free',
): OwnerView {
  return { owner, tier, limits: limitsFor(tier, 3), action };
}

export type Service = {
  me?: MeResponse | null;
  owners?: Record<string, OwnerView>;
  checkoutUrl?: string;
  portalUrl?: string;
  /** A refusal for every write: `{ status, error }`. */
  refuse?: { status: number; error: string };
  /** The whole service is down. */
  down?: boolean;
  /** What a request for Pro for Teams is answered: sent now, unless told it was already asked. */
  teamRequest?: { sent: boolean; askedAt: number };
};

/** When the tests' requests for Pro for Teams are made: 21 November 2026. */
export const ASKED_AT = Date.UTC(2026, 10, 21, 9);

export type Call = { path: string; method: string; auth: string | null; body: unknown };

/** A `fetch` that answers as the subscription Worker would, and the calls it took. */
export function serviceFetch(service: Service = {}) {
  const calls: Call[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'https://www.liveworkspace.app');
    const path = url.pathname.replace('/api/subscription', '') + url.search;
    const method = init?.method ?? 'GET';
    calls.push({
      path,
      method,
      auth: new Headers(init?.headers).get('authorization'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (service.down) return json({ error: 'unavailable' }, 503);
    if (path === '/prices') return json({ prices: priceList('GBP') });
    if (path === '/me') return json(service.me === undefined ? meResponse() : service.me);
    if (path.startsWith('/owner')) {
      const scope = url.searchParams.get('scope') ?? '';
      const view = service.owners?.[scope];
      return view ? json(view) : json({ error: 'not_found' }, 404);
    }
    if (method === 'POST' && service.refuse)
      return json({ error: service.refuse.error }, service.refuse.status);
    if (path === '/checkout')
      return json({ url: service.checkoutUrl ?? '/subscription/checkout?session=chk_1' });
    if (path === '/portal')
      return json({ url: service.portalUrl ?? '/subscription/billing?session=prt_1' });
    if (path === '/team-request')
      return json(service.teamRequest ?? { sent: true, askedAt: ASKED_AT });
    if (path === '/ended/dismiss') return json({ ok: true });
    return json({ error: 'not_found' }, 404);
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

export const tokenOf = (token: string | null) => async () => token;
