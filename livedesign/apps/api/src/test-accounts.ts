import type { TeamPerson } from '@liveworkspace/auth-client';
import type { Env } from './types';

// A stand-in for the liveworkspace accounts Worker's internal API (liveworkspace/docs/specs/003-accounts/accounts.md "The
// API"), for the tests of what livedesign keeps there: settings, profiles, sightings, milestones, verified
// addresses, activity, the teams it makes and a sender's notification allowance (liveworkspace/docs/specs/011-workbench/workbench.md). Answers the same shapes from memory, following the same rules (a patch per key,
// null deletes; a profile read answers an account's name until it sets one; a claim wins once; a milestone
// needs a sighting), and records every call so a test can count them.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

export const ACCOUNTS_ENV = {
  ACCOUNTS_URL: 'https://accounts.test',
  ACCOUNTS_CLIENT_ID: 'livedesign-test',
  ACCOUNTS_CLIENT_SECRET: 'secret',
} satisfies Partial<Env>;

// The index this app reports to, for the tests that count a person's designs there (the milestones).
export const INDEX_ENV = {
  INDEX_ORIGIN: 'https://index.test',
  INDEX_KEY: 'ld-key',
} satisfies Partial<Env>;

type Scoped = {
  all: Record<string, unknown>;
  app: Record<string, unknown>;
  updatedAt: number | null;
};
type StoredProfile = {
  name: string | null;
  color: string | null;
  createdAt: number;
  updatedAt: number;
  // The published Google picture the accounts Worker answers (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures").
  picture?: string | null;
};

export type FakeAccounts = {
  env: typeof ACCOUNTS_ENV;
  fetch: typeof fetch;
  // Every internal call, as [path, body].
  calls: { path: string; body: Record<string, unknown> }[];
  callsTo: (path: string) => { path: string; body: Record<string, unknown> }[];
  settings: Map<string, Scoped>;
  profiles: Map<string, StoredProfile>;
  // Accounts that exist: their account name and verified address.
  accounts: Map<string, { name: string | null; email: string | null }>;
  sightings: Set<string>;
  milestones: Set<string>;
  activity: { userId: string; at?: number }[];
  // Teams made through POST internal/teams, the admin read off the stand-in's `token-for-<id>` tokens.
  teams: { id: string; name: string; organisation: string | null; admin: string }[];
  // Each liveworkspace team's joined and invited people, by team id (internal/teams/members).
  teamPeople: Map<string, TeamPerson[]>;
  // How many designs each person has made, as the index counts them (INDEX_ENV's origin).
  designCounts: Map<string, number>;
  // Each sender's allowance uses, by `<personId> <kind>`: when each was taken.
  allowances: Map<string, number[]>;
  // Every phone notification asked for (POST internal/push), in order.
  pushes: { userId: string; kind: string; title: string; url: string; tag?: string }[];
  // Makes the next calls to a path fail with this status.
  failing: Map<string, number>;
};

function apply(row: Record<string, unknown>, patch: Record<string, unknown> | undefined): void {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete row[key];
    else row[key] = value;
  }
}

export function fakeAccounts(fallback?: typeof fetch): FakeAccounts {
  const state: FakeAccounts = {
    env: ACCOUNTS_ENV,
    fetch: undefined as unknown as typeof fetch,
    calls: [],
    callsTo: (path) => state.calls.filter((c) => c.path === path),
    settings: new Map(),
    profiles: new Map(),
    accounts: new Map(),
    sightings: new Set(),
    milestones: new Set(),
    activity: [],
    teams: [],
    teamPeople: new Map(),
    designCounts: new Map(),
    allowances: new Map(),
    pushes: [],
    failing: new Map(),
  };
  const prefix = `${ACCOUNTS_ENV.ACCOUNTS_URL}/api/account/internal/`;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  const scoped = (owner: string): Scoped =>
    state.settings.get(owner) ?? { all: {}, app: {}, updatedAt: null };
  const profileOf = (id: string) => {
    const own = state.profiles.get(id);
    const account = state.accounts.get(id);
    if (!own && !account) return null;
    return {
      id,
      name: own?.name ?? account?.name ?? null,
      color: own?.color ?? null,
      createdAt: own?.createdAt ?? null,
      updatedAt: own?.updatedAt ?? null,
      picture: own?.picture ?? null,
    };
  };

  state.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const counted = url.startsWith(INDEX_ENV.INDEX_ORIGIN)
      ? /\/app\/people\/([^/?]+)\/count(?:\?|$)/.exec(url)
      : null;
    if (counted) {
      const personId = decodeURIComponent(counted[1]!);
      state.calls.push({ path: 'index/count', body: { personId } });
      const limit = Number(new URL(url).searchParams.get('limit') ?? '1000');
      return json({ count: Math.min(state.designCounts.get(personId) ?? 0, limit) });
    }
    if (!url.startsWith(prefix)) {
      if (fallback) return fallback(input, init);
      throw new Error(`unexpected fetch ${url}`);
    }
    const path = url.slice(prefix.length);
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
      string,
      unknown
    >;
    state.calls.push({ path, body });
    const failure = state.failing.get(path);
    if (failure) return json({ error: 'failing' }, failure);
    const now = Date.now();
    switch (path) {
      case 'allowance': {
        const key = `${String(body.personId)} ${String(body.kind)}`;
        const windowMs = body.windowMs as number;
        const used = (state.allowances.get(key) ?? []).filter((at) => at > now - windowMs);
        const taken = Math.max(
          0,
          Math.min(body.count as number, (body.max as number) - used.length),
        );
        state.allowances.set(key, [...used, ...Array.from({ length: taken }, () => now)]);
        return json({ taken });
      }
      case 'settings/read': {
        const { all, app, updatedAt } = scoped(String(body.owner));
        return json({ all, app, updatedAt });
      }
      case 'settings/write': {
        const owner = String(body.owner);
        const row = scoped(owner);
        const patch = body.patch as {
          all?: Record<string, unknown>;
          app?: Record<string, unknown>;
        };
        const next = { all: { ...row.all }, app: { ...row.app }, updatedAt: now };
        apply(next.all, patch.all);
        apply(next.app, patch.app);
        state.settings.set(owner, next);
        return json(next);
      }
      case 'settings/notify': {
        const keys = body.keys as string[];
        const pick = (prefs: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(prefs).filter(([k]) => keys.includes(k)));
        const settings: Record<
          string,
          { all: Record<string, unknown>; app: Record<string, unknown> }
        > = {};
        for (const owner of body.owners as string[]) {
          const stored = state.settings.get(owner);
          if (stored) settings[owner] = { all: pick(stored.all), app: pick(stored.app) };
        }
        return json({ settings });
      }
      case 'teams/members': {
        const members = state.teamPeople.get(String(body.teamId));
        if (!members) return json({ error: 'not_found' }, 404);
        return json({ team: { id: body.teamId, name: 'Team' }, members });
      }
      case 'profiles/read': {
        const ids = body.ids as string[];
        return json({ profiles: ids.map(profileOf).filter(Boolean) });
      }
      case 'profiles/write': {
        const owner = String(body.owner);
        if (owner.startsWith('user_') && !state.accounts.has(owner)) {
          return json({ error: 'unknown_owner' }, 404);
        }
        const prev = state.profiles.get(owner);
        state.profiles.set(owner, {
          name: 'name' in body ? (body.name as string | null) : (prev?.name ?? null),
          color: 'color' in body ? (body.color as string | null) : (prev?.color ?? null),
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        });
        return json({ profile: profileOf(owner) });
      }
      case 'sightings': {
        const userId = String(body.userId);
        const first = state.accounts.has(userId) && !state.sightings.has(userId);
        state.sightings.add(userId);
        return json({ first });
      }
      case 'milestones/claim': {
        const key = `${String(body.userId)} ${String(body.milestone)}`;
        const claimed = state.sightings.has(String(body.userId)) && !state.milestones.has(key);
        if (claimed) state.milestones.add(key);
        return json({ claimed });
      }
      case 'emails': {
        const emails: Record<string, string> = {};
        for (const id of body.ids as string[]) {
          const email = state.accounts.get(id)?.email;
          if (email) emails[id] = email;
        }
        return json({ emails });
      }
      case 'push': {
        const notifications = body.notifications as FakeAccounts['pushes'];
        state.pushes.push(...notifications);
        return json({ accepted: notifications.length }, 202);
      }
      case 'activity':
        state.activity.push({ userId: String(body.userId), at: body.at as number | undefined });
        return json({ ok: true });
      case 'teams': {
        const admin = String(body.accessToken).replace(/^token-for-/, '');
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return json({ error: 'name_required' }, 400);
        const team = {
          id: `team_${state.teams.length + 1}`,
          name,
          organisation: (body.organisation as string | null) ?? null,
          admin,
        };
        state.teams.push(team);
        return json(
          {
            ...team,
            role: 'admin',
            memberCount: 1,
            invitedCount: 0,
            members: [
              {
                id: `member_${team.id}`,
                name: null,
                email: `${admin}@example.test`,
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
  };
  return state;
}
