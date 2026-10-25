// Tests' view of the liveworkspace accounts Worker's internal routes (liveworkspace/docs/accounts.md
// "The API"): settings, profiles, sightings, milestones, emails, teams' people, the teams it makes, activity and
// a sender's notification allowance (liveworkspace/docs/workbench.md),
// kept in memory with the same rules (a write is a patch per key, null deletes; a milestone claims once, and only
// after a sighting). Stubs the global fetch; batches posted to the telemetry service are kept too, and the
// index's count of a person's plans (`planCounts`, at INDEX_ON's origin) is answered as well. Pair with
// ACCOUNTS_ON (and INDEX_ON) in the env, and restore with vi.unstubAllGlobals.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

import { vi } from 'vitest';
import { TELEMETRY_EVENTS_PATH, type TelemetryBatch } from '@liveworkspace/telemetry';
import type { Profile, TeamPerson } from '@liveworkspace/auth-client';
import type { Env } from './types';

export const ACCOUNTS_URL = 'https://accounts.test';
export const ACCOUNTS_ON = {
  ACCOUNTS_URL,
  ACCOUNTS_CLIENT_ID: 'liveplanner',
  ACCOUNTS_CLIENT_SECRET: 'secret',
} as Partial<Env>;

export const INDEX_ORIGIN = 'https://index.test';
export const INDEX_ON = { INDEX_ORIGIN, INDEX_KEY: 'lp-key' } as Partial<Env>;

type Prefs = Record<string, unknown>;

export type FakeAccounts = {
  settings: Map<string, { all: Prefs; app: Prefs }>;
  profiles: Map<string, Profile>;
  sightings: Set<string>;
  milestones: Set<string>;
  emails: Map<string, string>;
  activity: { userId: string; at?: number }[];
  // Each team's joined and invited people, by team id.
  teams: Map<string, TeamPerson[]>;
  // Teams made through POST internal/teams, the admin read off the stand-in's `token-for-<id>` tokens.
  madeTeams: { id: string; name: string; organisation: string | null; admin: string }[];
  // How many plans each person has made, as the index counts them.
  planCounts: Map<string, number>;
  // Each sender's allowance uses, by `<personId> <kind>`: when each was taken.
  allowances: Map<string, number[]>;
  // Every internal call, as `<path> <json body>`.
  calls: { path: string; body: Record<string, unknown> }[];
  telemetry: TelemetryBatch['events'];
  // Answer every internal call with this status instead (an outage, a refusal).
  failWith: number | null;
};

const INTERNAL = '/api/account/internal';

function patchScope(stored: Prefs, patch: Prefs | undefined): Prefs {
  const next = { ...stored };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

export function stubAccounts(): FakeAccounts {
  const fake: FakeAccounts = {
    settings: new Map(),
    profiles: new Map(),
    sightings: new Set(),
    milestones: new Set(),
    emails: new Map(),
    activity: [],
    teams: new Map(),
    madeTeams: [],
    planCounts: new Map(),
    allowances: new Map(),
    calls: [],
    telemetry: [],
    failWith: null,
  };
  const answer = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const text = typeof init?.body === 'string' ? init.body : '{}';
    if (url.pathname.endsWith(TELEMETRY_EVENTS_PATH)) {
      fake.telemetry.push(...(JSON.parse(text) as TelemetryBatch).events);
      return new Response(null, { status: 204 });
    }
    const counted = /\/app\/people\/([^/]+)\/count$/.exec(url.pathname);
    if (url.origin === INDEX_ORIGIN && counted) {
      fake.calls.push({
        path: '/index/count',
        body: { personId: decodeURIComponent(counted[1]!) },
      });
      const limit = Number(url.searchParams.get('limit') ?? '1000');
      const n = fake.planCounts.get(decodeURIComponent(counted[1]!)) ?? 0;
      return answer({ count: Math.min(n, limit) });
    }
    if (url.origin !== ACCOUNTS_URL || !url.pathname.startsWith(INTERNAL)) {
      return new Response(null, { status: 404 });
    }
    const path = url.pathname.slice(INTERNAL.length);
    const body = JSON.parse(text) as Record<string, unknown>;
    fake.calls.push({ path, body });
    if (fake.failWith !== null) return answer({ error: 'stub_failure' }, fake.failWith);
    const now = Date.now();
    switch (path) {
      case '/settings/read':
      case '/settings/write': {
        const owner = body.owner as string;
        const stored = fake.settings.get(owner) ?? { all: {}, app: {} };
        if (path === '/settings/write') {
          const patch = body.patch as { all?: Prefs; app?: Prefs };
          const next = {
            all: patchScope(stored.all, patch.all),
            app: patchScope(stored.app, patch.app),
          };
          fake.settings.set(owner, next);
          return answer({ ...next, updatedAt: now });
        }
        return answer({ ...stored, updatedAt: null });
      }
      case '/settings/notify': {
        const owners = body.owners as string[];
        const keys = body.keys as string[];
        const pick = (prefs: Prefs) =>
          Object.fromEntries(Object.entries(prefs).filter(([k]) => keys.includes(k)));
        const settings: Record<string, { all: Prefs; app: Prefs }> = {};
        for (const owner of owners) {
          const stored = fake.settings.get(owner);
          if (stored) settings[owner] = { all: pick(stored.all), app: pick(stored.app) };
        }
        return answer({ settings });
      }
      case '/teams': {
        const admin = String(body.accessToken).replace(/^token-for-/, '');
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return answer({ error: 'name_required' }, 400);
        const team = {
          id: `team_${fake.madeTeams.length + 1}`,
          name,
          organisation: (body.organisation as string | null) ?? null,
          admin,
        };
        fake.madeTeams.push(team);
        return answer(
          {
            id: team.id,
            name: team.name,
            organisation: team.organisation,
            role: 'admin',
            memberCount: 1,
            invitedCount: 0,
            members: [
              {
                id: `member_${team.id}`,
                name: null,
                email: fake.emails.get(admin) ?? `${admin}@example.test`,
                role: 'admin',
              },
            ],
          },
          201,
        );
      }
      case '/teams/members': {
        const members = fake.teams.get(body.teamId as string);
        if (!members) return answer({ error: 'not_found' }, 404);
        return answer({ team: { id: body.teamId, name: 'Team' }, members });
      }
      case '/profiles/read': {
        const ids = body.ids as string[];
        return answer({ profiles: ids.flatMap((id) => fake.profiles.get(id) ?? []) });
      }
      case '/profiles/write': {
        const owner = body.owner as string;
        const prior = fake.profiles.get(owner);
        const profile: Profile = {
          id: owner,
          name: body.name === undefined ? (prior?.name ?? null) : (body.name as string | null),
          color: body.color === undefined ? (prior?.color ?? null) : (body.color as string | null),
          createdAt: prior?.createdAt ?? now,
          updatedAt: now,
        };
        fake.profiles.set(owner, profile);
        return answer({ profile });
      }
      case '/sightings': {
        const userId = body.userId as string;
        const first = !fake.sightings.has(userId);
        fake.sightings.add(userId);
        return answer({ first });
      }
      case '/milestones/claim': {
        const key = `${String(body.userId)} ${String(body.milestone)}`;
        const claimed = fake.sightings.has(body.userId as string) && !fake.milestones.has(key);
        if (claimed) fake.milestones.add(key);
        return answer({ claimed });
      }
      case '/emails': {
        const ids = body.ids as string[];
        return answer({
          emails: Object.fromEntries(
            ids.flatMap((id) => (fake.emails.has(id) ? [[id, fake.emails.get(id)]] : [])),
          ),
        });
      }
      case '/allowance': {
        const key = `${String(body.personId)} ${String(body.kind)}`;
        const windowMs = body.windowMs as number;
        const used = (fake.allowances.get(key) ?? []).filter((at) => at > now - windowMs);
        const taken = Math.max(
          0,
          Math.min(body.count as number, (body.max as number) - used.length),
        );
        fake.allowances.set(key, [...used, ...Array.from({ length: taken }, () => now)]);
        return answer({ taken });
      }
      case '/activity':
        fake.activity.push(body as { userId: string; at?: number });
        return answer({ ok: true });
      default:
        return new Response(null, { status: 404 });
    }
  });
  return fake;
}

// A profile as the accounts Worker keeps one.
export function profileOf(id: string, name: string | null, color: string | null, at = 1): Profile {
  return { id, name, color, createdAt: at, updatedAt: at };
}
