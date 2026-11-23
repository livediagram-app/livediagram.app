import { describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import type { VersionListResponse } from '@livedocuments/api-schema';
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The version list with Pro on (docs/specs/006-document/version-history.md "With Pro on"): the answer says how long
// the document's owner's tier keeps automatic versions, read by the server from the owner the index's grant names,
// never from the reader's own tier or anything the request claims.

const room = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
};

// Each test's own owners: the entitlement cache is the isolate's.
let serial = 0;
const account = () => `user_rail${++serial}`;

function service(tiers: Record<string, Tier>) {
  const asked: string[] = [];
  return {
    asked,
    vars: {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'k',
      SUBSCRIPTION: {
        fetch: async (_input: string, init?: RequestInit) => {
          const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
          asked.push(owner);
          const tier = tiers[owner] ?? 'free';
          return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
        },
      },
    },
  };
}

async function setUp(env: Partial<Env>, owner: string) {
  const db = sqliteD1({ DOCUMENT_ROOM: room, ...env } as unknown as Partial<Env>);
  const created = await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      owner,
      accountUserId: owner,
      verifiedUserId: owner,
      body: { id: 'D', name: 'Board', tabs: [{ id: 't1', name: 'Board', elements: [] }] },
    }),
  );
  expect(created.status).toBe(201);
  return db;
}

const list = async (
  db: SqliteD1,
  reader: string,
  grant: { owner?: string; team?: string | null },
  headers: Record<string, string> = {},
) => {
  const res = await handleDocuments(
    makeTestRouteContext('GET', '/api/documents/D/tabs/t1/versions', {
      env: db.env,
      owner: reader,
      accountUserId: reader,
      verifiedUserId: reader,
      headers,
      grant: {
        item: 'D',
        level: 'view',
        tab: null,
        sub: reader,
        team: grant.team ?? null,
        ...(grant.owner ? { owner: grant.owner } : {}),
        exp: 9_999_999_999,
        shareCode: null,
        token: 't',
      },
    }),
  );
  expect(res.status).toBe(200);
  return res.json<VersionListResponse>();
};

describe('the version list with Pro', () => {
  it('answers as it always did with Pro off, and asks nothing', async () => {
    const owner = account();
    const { asked, vars } = service({});
    const db = await setUp({ ...vars, PRO_ENABLED: 'false' }, owner);
    expect(await list(db, owner, { owner })).toEqual({ versions: [] });
    expect(asked).toEqual([]);
  });

  it('says a Free owner’s document keeps 7 days, whoever reads it and whatever they claim', async () => {
    const owner = account();
    const reader = account();
    // The reader is on Pro; the document is not theirs.
    const { asked, vars } = service({ [`p:${reader}`]: 'pro' });
    const db = await setUp(vars, owner);
    const listed = await list(
      db,
      reader,
      { owner },
      { 'X-Subscription-Tier': 'pro', 'X-Tier': 'team' },
    );
    expect(listed.retention).toEqual({ days: 7, owner: `p:${owner}` });
    expect(asked).toEqual([`p:${owner}`]);
    expect(db.sql.prepare('SELECT max_age_ms FROM version_retention').get()).toEqual({
      max_age_ms: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it('says a Pro for Teams team’s document has no age limit, and holds it to the safety caps', async () => {
    const owner = account();
    const team = `team_rail${++serial}`;
    const { vars } = service({ [`t:${team}`]: 'team' });
    const db = await setUp(vars, owner);
    expect((await list(db, owner, { owner, team })).retention).toEqual({
      days: null,
      owner: `t:${team}`,
    });
    expect(db.sql.prepare('SELECT max_age_ms, max_count FROM version_retention').get()).toEqual({
      max_age_ms: null,
      max_count: 500,
    });
  });

  it('says nothing of a tier, and changes nothing, for a grant that names no owner', async () => {
    const owner = account();
    const { asked, vars } = service({});
    const db = await setUp(vars, owner);
    expect(await list(db, owner, {})).toEqual({ versions: [] });
    expect(asked).toEqual([]);
  });
});
