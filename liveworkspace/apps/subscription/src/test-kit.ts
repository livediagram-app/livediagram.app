// What the Worker's tests share: access tokens signed with a key the test's accounts binding publishes, and calls
// over HTTP as an app's Worker and as a page make them. Not a `.test.ts` file, so vitest doesn't collect it.

import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type { OwnerScope, SubscriptionState } from '@liveworkspace/subscription';
import type { Env } from './env';
import worker from './index';
import type { SubscriptionRow } from './subscriptions/state';
import { writeSubscriptionStatement } from './subscriptions/store';

export const BASE = 'https://www.liveworkspace.app/api/subscription';
export const ACCOUNTS = 'https://accounts.test';
export const AUDIENCE = 'https://livediagram.app/api';
export const SITE = 'https://www.liveworkspace.app';

export type Signer = {
  /** What the env needs for the account check to pass against this signer's key. */
  env: Pick<Env, 'ACCOUNTS_URL' | 'INDEX_AUDIENCES' | 'ACCOUNTS'>;
  token: (sub: string, claims?: Record<string, unknown>) => Promise<string>;
  /** A token signed by a key accounts never published. */
  forged: (sub: string) => Promise<string>;
};

export async function signer(): Promise<Signer> {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'acc1', alg: 'EdDSA' };
  const stranger = (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey;
  const sign = (sub: string, claims: Record<string, unknown>, key: CryptoKey) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'EdDSA', kid: 'acc1' })
      .setIssuer(`${ACCOUNTS}/api/auth`)
      .setAudience(AUDIENCE)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  return {
    env: {
      ACCOUNTS_URL: ACCOUNTS,
      INDEX_AUDIENCES: AUDIENCE,
      ACCOUNTS: { fetch: async () => Response.json({ keys: [jwk] }) },
    },
    token: (sub, claims = {}) => sign(sub, claims, pair.privateKey),
    forged: (sub) => sign(sub, {}, stranger),
  };
}

/** One of a team's people, as accounts lists them. */
export type TeamPersonStub = {
  userId: string;
  name?: string;
  role?: 'admin' | 'member';
  status?: 'joined' | 'invited';
};

/**
 * Accounts as the Worker reaches it: the token keys (the signer's) and `teams/members`, answered from `teams`, which
 * a test changes as it goes (a role taken away, a team gone). `down: true` makes every members call fail. It
 * also answers `teams/member-counts` (each call's teams are kept in `counted`) and `profiles/read` from `names`.
 */
export function accountsStub(keys: Signer, teams: Record<string, TeamPersonStub[]>) {
  const state = {
    teams,
    down: false,
    asked: [] as string[],
    counted: [] as string[][],
    names: {} as Record<string, string>,
  };
  const env: Pick<Env, 'ACCOUNTS' | 'ACCOUNTS_CLIENT_ID' | 'ACCOUNTS_CLIENT_SECRET'> = {
    ACCOUNTS_CLIENT_ID: 'client-1',
    ACCOUNTS_CLIENT_SECRET: 'secret-1',
    ACCOUNTS: {
      fetch: async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.endsWith('/teams/member-counts')) {
          const { teamIds } = JSON.parse(String(init?.body)) as { teamIds: string[] };
          state.counted.push(teamIds);
          if (state.down) return new Response(null, { status: 503 });
          const joined = (id: string) =>
            state.teams[id]!.filter((person) => (person.status ?? 'joined') === 'joined').length;
          return Response.json({
            counts: Object.fromEntries(
              teamIds.filter((id) => state.teams[id]).map((id) => [id, joined(id)]),
            ),
          });
        }
        if (url.endsWith('/profiles/read')) {
          if (state.down) return new Response(null, { status: 503 });
          const { ids } = JSON.parse(String(init?.body)) as { ids: string[] };
          return Response.json({
            profiles: ids
              .filter((id) => state.names[id] !== undefined)
              .map((id) => ({ id, name: state.names[id], color: null })),
          });
        }
        if (!url.endsWith('/teams/members')) return keys.env.ACCOUNTS!.fetch(input, init);
        const { teamId } = JSON.parse(String(init?.body)) as { teamId: string };
        state.asked.push(teamId);
        if (state.down) return new Response(null, { status: 503 });
        const people = state.teams[teamId];
        if (!people) return new Response(null, { status: 404 });
        return Response.json({
          team: { id: teamId, name: 'T' },
          members: people.map((person, at) => ({
            id: `m${at}`,
            userId: person.userId,
            email: `${person.userId}@example.com`,
            name: person.name ?? null,
            role: person.role ?? 'member',
            status: person.status ?? 'joined',
          })),
        });
      },
    },
  };
  return { env, state };
}

export const call = (env: Env, path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`${BASE}${path}`, init), env);

/** A POST to an internal route as an app's own Worker: its key, its name. */
export const asApp = (
  env: Env,
  path: string,
  body: unknown,
  app = 'livediagram.app',
  key = 'ld-key',
) =>
  call(env, `/internal${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'X-Subscription-App': app,
    },
  });

/** A page's request: its Origin, and the person's access token when there is one. */
export function fromPage(bearer: string | null, body?: unknown, origin = SITE): RequestInit {
  return {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
  };
}

export const DAY = 24 * 60 * 60 * 1000;

/** A subscription's row as the tests arrange one: active from `now` for thirty days unless told otherwise. */
export function rowOf(
  owner: OwnerScope,
  now: number,
  patch: Partial<SubscriptionRow> & { state?: SubscriptionState } = {},
): SubscriptionRow {
  const team = owner.startsWith('t:');
  return {
    owner,
    tier: team ? 'team' : 'pro',
    state: 'active',
    seats: team ? 3 : 1,
    currency: 'GBP',
    unit_amount: team ? 6 : 8,
    period_start: now,
    period_end: now + 30 * DAY,
    anchor_day: new Date(now).getUTCDate(),
    grace_end: null,
    cancel_at_period_end: 0,
    provider: 'mock',
    provider_ref: null,
    subscribed_by: 'user_ada',
    seats_checked_at: now,
    ended_at: null,
    ended_seen: 0,
    created_at: now,
    updated_at: now,
    ...patch,
  };
}

export async function subscribe(
  env: Env,
  owner: OwnerScope,
  now: number,
  patch: Partial<SubscriptionRow> = {},
): Promise<SubscriptionRow> {
  const row = rowOf(owner, now, patch);
  await writeSubscriptionStatement(env.SUBSCRIPTION_DB, row).run();
  return row;
}
