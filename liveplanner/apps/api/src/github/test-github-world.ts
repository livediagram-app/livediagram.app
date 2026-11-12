// A world for the GitHub App's tests (docs/specs/026-plan/github-pull-requests.md; blueprint "Part 2"): the
// automation world's real worker and PlanRooms with the App's settings set, an in-memory GITHUB_LINKS namespace, a
// stand-in GitHub that answers the calls the connection makes (and records them), and helpers that sign a delivery
// and seed a plan's connection. Not a `.test.ts` file, so vitest does not collect it.
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { vi } from 'vitest';
import { createPlan } from '../plan-room/test-repeat-world';
import {
  automationWorld,
  type AutomationWorld,
} from '../plan-room/automations/test-automation-world';
import { linksOf, saveConnection, type GithubConnection } from '../plan-room/github/github-store';
import { NO_LINKS, rewriteLinks } from './github-links';
import type { PlanEnv } from '../types';

export { prPayload, suitePayload, type PrPayload } from './test-github-payloads';

export const WEBHOOK_SECRET = 'whsec-test-0123456789';
export const CLIENT_SECRET = 'client-secret-test';

// One App key for the whole run, as GitHub gives it (PKCS#1).
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const APP_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
export const APP_PUBLIC_KEY = publicKey;

/** A GITHUB_LINKS namespace in memory: put, delete and list by prefix, as KV answers them. */
export function fakeKv() {
  const store = new Map<string, string>();
  const kv = {
    put: async (key: string, value: string) => void store.set(key, value),
    delete: async (key: string) => void store.delete(key),
    get: async (key: string) => store.get(key) ?? null,
    list: async ({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number } = {}) => {
      const names = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      return {
        keys: names.slice(0, limit).map((name) => ({ name })),
        list_complete: names.length <= limit,
        cacheStatus: null,
      };
    },
  };
  return { kv: kv as unknown as KVNamespace, keys: () => [...store.keys()].sort(), store };
}

export const githubEnv = (links: KVNamespace) => ({
  GITHUB_APP_ID: '123',
  GITHUB_APP_SLUG: 'liveplanner-test',
  GITHUB_APP_PRIVATE_KEY: APP_PRIVATE_KEY,
  GITHUB_APP_CLIENT_ID: 'Iv1.client',
  GITHUB_APP_CLIENT_SECRET: CLIENT_SECRET,
  GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GITHUB_LINKS: links,
});

// What the stand-in GitHub answers, per call; a test changes any of them.
export type GithubStandIn = {
  token: string | null;
  // The person's reachable repositories in the installation, or null for GitHub's 404.
  userRepositories: { id: number; full_name: string; private?: boolean }[] | null;
  installation: { account: { login: string }; suspended_at: string | null } | null;
  installationToken: string | null;
  installationRepositories: { id: number; full_name: string; private?: boolean }[] | null;
  // A page of either repository list that answers 500, or null for none.
  failingPage: number | null;
};

export type GithubCall = { method: string; url: string; body: string };

export type GithubWorld = AutomationWorld & {
  kv: ReturnType<typeof fakeKv>;
  gh: GithubStandIn;
  ghCalls: GithubCall[];
  planEnv: (planId: string) => PlanEnv;
  seed: (planId: string, c: GithubConnection) => Promise<void>;
  deliver: (
    event: string,
    payload: unknown,
    init?: { id?: string; secret?: string; signature?: string | null; body?: string },
  ) => Promise<Response>;
};

export const repo = (id: number, fullName = `acme/repo-${id}`, isPrivate = false) => ({
  id,
  full_name: fullName,
  private: isPrivate,
});

export const connection = (
  installationId: number,
  repos: { id: number; chosen?: boolean }[],
): GithubConnection => ({
  installationId,
  account: 'acme',
  connectedBy: { id: 'p_hash', name: 'Ada' } as never,
  connectedAt: 1,
  repositories: repos.map((r) => ({
    id: r.id,
    fullName: `acme/repo-${r.id}`,
    private: false,
    chosen: r.chosen ?? true,
  })),
});

export const sign = (body: string, secret = WEBHOOK_SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const isGithub = (url: string) =>
  url.startsWith('https://api.github.com/') || url.startsWith('https://github.com/');

// One page of a repository list, as GitHub pages it: `per_page` and `page` read, a `Link` header naming the next.
function listPage(gh: GithubStandIn, u: URL, all: unknown[]): Response {
  const perPage = Number(u.searchParams.get('per_page') ?? 30);
  const page = Number(u.searchParams.get('page') ?? 1);
  if (page === gh.failingPage) return Response.json({ message: 'Server Error' }, { status: 500 });
  const repositories = all.slice((page - 1) * perPage, page * perPage);
  const next = page * perPage < all.length;
  const link: Record<string, string> = next
    ? { Link: `<${u.origin}${u.pathname}?page=${page + 1}>; rel="next"` }
    : {};
  return Response.json({ total_count: all.length, repositories }, { headers: link });
}

function standIn(gh: GithubStandIn, url: string, method: string): Response {
  const u = new URL(url);
  const notFound = () => Response.json({ message: 'Not Found' }, { status: 404 });
  if (u.pathname === '/login/oauth/access_token')
    return Response.json(
      gh.token ? { access_token: gh.token } : { error: 'bad_verification_code' },
    );
  if (u.pathname.startsWith('/user/installations/'))
    return gh.userRepositories ? listPage(gh, u, gh.userRepositories) : notFound();
  if (u.pathname.startsWith('/applications/') && method === 'DELETE')
    return new Response(null, { status: 204 });
  if (u.pathname.endsWith('/access_tokens'))
    return gh.installationToken
      ? Response.json({ token: gh.installationToken }, { status: 201 })
      : notFound();
  if (u.pathname.startsWith('/app/installations/'))
    return gh.installation ? Response.json(gh.installation) : notFound();
  if (u.pathname === '/installation/repositories')
    return gh.installationRepositories ? listPage(gh, u, gh.installationRepositories) : notFound();
  return notFound();
}

export async function githubWorld(planIds: string[] = ['A']): Promise<GithubWorld> {
  const w = await automationWorld(planIds[0]);
  for (const id of planIds.slice(1)) await createPlan(w, id);
  const kv = fakeKv();
  Object.assign(w.env, githubEnv(kv.kv));
  // Each room woken again, so it holds the App's settings.
  for (const id of planIds) w.plans.get(id)!.restart();
  const gh: GithubStandIn = {
    token: 'gho_person_token',
    userRepositories: [repo(11), repo(12, 'acme/secret', true)],
    installation: { account: { login: 'acme' }, suspended_at: null },
    installationToken: 'ghs_installation_token',
    installationRepositories: [repo(11), repo(12, 'acme/secret', true)],
    failingPage: null,
  };
  const ghCalls: GithubCall[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!isGithub(url)) return Response.json({ ok: true });
    const method = init.method ?? 'GET';
    ghCalls.push({ method, url, body: typeof init.body === 'string' ? init.body : '' });
    return standIn(gh, url, method);
  });
  const planEnv = (planId: string) => w.plans.get(planId)!.room.requireEnv();
  const seed = async (planId: string, c: GithubConnection) => {
    await saveConnection(planEnv(planId).PLAN_DB, planId, c);
    await rewriteLinks(kv.kv, planId, NO_LINKS, linksOf(c));
  };
  const deliver: GithubWorld['deliver'] = (event, payload, init = {}) => {
    const body = init.body ?? JSON.stringify(payload);
    const signature = init.signature === undefined ? sign(body, init.secret) : init.signature;
    return w.raw(
      new Request('https://api.test/api/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': event,
          'X-GitHub-Delivery': init.id ?? crypto.randomUUID(),
          ...(signature === null ? {} : { 'X-Hub-Signature-256': signature }),
        },
        body,
      }),
    );
  };
  return { ...w, kv, gh, ghCalls, planEnv, seed, deliver };
}
