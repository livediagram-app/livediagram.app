// A stand-in for the liveworkspace accounts Worker's app API (liveworkspace/docs/specs/003-accounts/accounts.md "The API",
// the routes an app's server calls with its client credentials) for tests, in this process: settings
// in their two scopes, profiles, sightings, milestones, emails, activity, making a team and a sender's
// notification allowance (liveworkspace/docs/specs/011-workbench/workbench.md) and phone notifications, answered
// from in-memory records through a stubbed `fetch`, with the same semantics the real Worker has (a
// settings patch per key, null deleting; an account's profile falling back to its account name). Not a
// `.test.ts` file, so vitest doesn't collect it.

import { vi } from 'vitest';
import { __resetProfileCache } from './liveworkspace/profiles';
import type { Env } from './types';

const ACCOUNTS_URL = 'https://accounts.test';
const INTERNAL = `${ACCOUNTS_URL}/api/account/internal`;

type Blob = Record<string, unknown>;

export type TestAccountsService = {
  // `${owner} ${scope}` → the stored scope. Owners as liveworkspace spells them (`guest_<uuid>`).
  settings: Map<string, Blob>;
  profiles: Map<string, { name: string | null; color: string | null; createdAt: number }>;
  // Account ids with an account behind them, and their account names.
  accounts: Map<string, { name: string | null; email: string | null }>;
  sightings: Set<string>;
  milestones: Set<string>;
  activity: { userId: string; at?: number }[];
  teams: { id: string; name: string; organisation: string | null; admin: string }[];
  // Each sender's allowance uses, by `<personId> <kind>`: when each was taken.
  allowances: Map<string, number[]>;
  // Every phone notification asked for (POST internal/push), in order.
  pushes: { userId: string; kind: string; title: string; url: string; tag?: string }[];
  // Every call this api made, as `METHOD /route`.
  calls: string[];
  // When set, every call answers this status.
  failWith: number | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Points `env` at a fresh stand-in and routes its calls there; any other URL goes to whatever `fetch`
// was before. Undo with vi.unstubAllGlobals().
export function accountsServiceFor(env: Partial<Env>): TestAccountsService {
  __resetProfileCache();
  env.ACCOUNTS_URL = ACCOUNTS_URL;
  env.ACCOUNTS_CLIENT_ID ??= 'livehuddle';
  env.ACCOUNTS_CLIENT_SECRET ??= 'secret';
  const service: TestAccountsService = {
    settings: new Map(),
    profiles: new Map(),
    accounts: new Map(),
    sightings: new Set(),
    milestones: new Set(),
    activity: [],
    teams: [],
    allowances: new Map(),
    pushes: [],
    calls: [],
    failWith: null,
  };
  const previous = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(INTERNAL)) return previous(input, init);
    const route = request.url.slice(INTERNAL.length);
    service.calls.push(`${request.method} ${route}`);
    if (service.failWith) return json({ error: 'stand_in_failure' }, service.failWith);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return answer(service, route, body);
  });
  return service;
}

function scopeOf(service: TestAccountsService, owner: string, scope: string): Blob {
  return service.settings.get(`${owner} ${scope}`) ?? {};
}

function answer(service: TestAccountsService, route: string, body: Record<string, unknown>) {
  switch (route) {
    case '/settings/read': {
      const owner = String(body.owner);
      return json({
        all: scopeOf(service, owner, 'all'),
        app: scopeOf(service, owner, String(body.app)),
        updatedAt: null,
      });
    }
    case '/settings/write': {
      const owner = String(body.owner);
      const patch = body.patch as { all?: Blob; app?: Blob };
      for (const [scope, values] of [
        ['all', patch.all],
        [String(body.app), patch.app],
      ] as const) {
        if (!values) continue;
        const next = { ...scopeOf(service, owner, scope) };
        for (const [key, value] of Object.entries(values)) {
          if (value === null) delete next[key];
          else next[key] = value;
        }
        service.settings.set(`${owner} ${scope}`, next);
      }
      return json({
        all: scopeOf(service, owner, 'all'),
        app: scopeOf(service, owner, String(body.app)),
        updatedAt: Date.now(),
      });
    }
    case '/profiles/read': {
      const profiles = (body.ids as string[]).flatMap((id) => {
        const own = service.profiles.get(id);
        const account = service.accounts.get(id);
        if (!own && !account) return [];
        return [
          {
            id,
            name: own?.name ?? account?.name ?? null,
            color: own?.color ?? null,
            createdAt: own?.createdAt ?? null,
            updatedAt: own?.createdAt ?? null,
          },
        ];
      });
      return json({ profiles });
    }
    case '/profiles/write': {
      const owner = String(body.owner);
      if (owner.startsWith('user_') && !service.accounts.has(owner)) {
        return json({ error: 'unknown_owner' }, 404);
      }
      const prior = service.profiles.get(owner);
      const next = {
        name: 'name' in body ? (body.name as string | null) : (prior?.name ?? null),
        color: 'color' in body ? (body.color as string | null) : (prior?.color ?? null),
        createdAt: prior?.createdAt ?? Date.now(),
      };
      service.profiles.set(owner, next);
      return json({
        profile: {
          id: owner,
          name: next.name ?? service.accounts.get(owner)?.name ?? null,
          color: next.color,
          createdAt: next.createdAt,
          updatedAt: Date.now(),
        },
      });
    }
    case '/sightings': {
      const userId = String(body.userId);
      const first = service.accounts.has(userId) && !service.sightings.has(userId);
      service.sightings.add(userId);
      return json({ first });
    }
    case '/milestones/claim': {
      const key = `${String(body.userId)} ${String(body.milestone)}`;
      const claimed = service.sightings.has(String(body.userId)) && !service.milestones.has(key);
      service.milestones.add(key);
      return json({ claimed });
    }
    case '/emails': {
      const emails: Record<string, string> = {};
      for (const id of body.ids as string[]) {
        const email = service.accounts.get(id)?.email;
        if (email) emails[id] = email;
      }
      return json({ emails });
    }
    case '/allowance': {
      const now = Date.now();
      const key = `${String(body.personId)} ${String(body.kind)}`;
      const windowMs = body.windowMs as number;
      const used = (service.allowances.get(key) ?? []).filter((at) => at > now - windowMs);
      const taken = Math.max(0, Math.min(body.count as number, (body.max as number) - used.length));
      service.allowances.set(key, [...used, ...Array.from({ length: taken }, () => now)]);
      return json({ taken });
    }
    case '/push': {
      const notifications = body.notifications as TestAccountsService['pushes'];
      service.pushes.push(...notifications);
      return json({ accepted: notifications.length }, 202);
    }
    case '/activity':
      service.activity.push({ userId: String(body.userId), at: body.at as number | undefined });
      return json({ ok: true });
    case '/teams': {
      const admin = String(body.accessToken).replace(/^token-for-/, '');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return json({ error: 'name_required' }, 400);
      const team = {
        id: `team_${service.teams.length + 1}`,
        name,
        organisation: (body.organisation as string | null) ?? null,
        admin,
      };
      service.teams.push(team);
      return json(
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
              email: service.accounts.get(admin)?.email ?? `${admin}@example.test`,
              role: 'admin',
            },
          ],
        },
        201,
      );
    }
    default:
      return json({ error: 'not_found' }, 404);
  }
}
