// Connecting a plan to GitHub, inside its room (docs/specs/026-plan/github-pull-requests.md "Connecting a
// repository"; blueprint "Part 2" "The plan's object"). The start keeps a one-time state's hash with whoever asked;
// the callback spends it before anything else, then checks, as that person, which of the installation's repositories
// they can reach, revokes their token, checks the installation is the App's own and not suspended, and saves the
// connection. Nothing here stores or logs a token, a code or a state.
import { base64url } from '../../github/app-auth';
import {
  appInstallation,
  exchangeCode,
  revokeUserToken,
  userInstallationRepositories,
  type GithubRepository,
} from '../../github/github-api';
import {
  GITHUB_WEB,
  PLANS_PER_REPOSITORY_MAX,
  REPOSITORIES_MAX,
  type GithubConfig,
} from '../../github/github-config';
import { plansOfRepository, rewriteLinks } from '../../github/github-links';
import type { ItemPerson } from '@liveplanner/items';
import { sha256Hex } from '../automations/automation-incoming';
import {
  addConnectState,
  claimConnectState,
  linksOf,
  readConnection,
  saveConnection,
  type GithubConnection,
} from './github-store';

const STATE_BYTES = 32;

/** A new state for `planId`: the address's `{plan id}.{secret}`, and the secret's hash kept with `person`. */
export async function startConnect(
  db: D1Database,
  config: GithubConfig,
  planId: string,
  person: ItemPerson,
  now: number,
): Promise<string> {
  const secret = base64url(crypto.getRandomValues(new Uint8Array(STATE_BYTES)));
  await addConnectState(db, await sha256Hex(secret), JSON.stringify(person), now);
  const state = encodeURIComponent(`${planId}.${secret}`);
  return `${GITHUB_WEB}/apps/${encodeURIComponent(config.slug)}/installations/new?state=${state}`;
}

/** The repositories among `ids` that another plan's count leaves room for (PLANS_PER_REPOSITORY_MAX). */
export async function withRoom(
  kv: KVNamespace,
  planId: string,
  ids: readonly number[],
): Promise<Set<number>> {
  const counts = await Promise.all(
    ids.map(async (id) => {
      const plans = await plansOfRepository(kv, id, PLANS_PER_REPOSITORY_MAX + 1);
      return [id, plans.filter((p) => p !== planId).length] as const;
    }),
  );
  return new Set(counts.filter(([, n]) => n < PLANS_PER_REPOSITORY_MAX).map(([id]) => id));
}

export type ConnectCallback = { secret: string; code: string; installationId: number };

const failed = (why: string): 'failed' => {
  console.info('[github] connect', { outcome: 'failed', why });
  return 'failed';
};

function personOf(text: string): ItemPerson | null {
  try {
    const p = JSON.parse(text) as Partial<ItemPerson>;
    return typeof p.id === 'string' && typeof p.name === 'string' ? (p as ItemPerson) : null;
  } catch {
    return null;
  }
}

// The person's reachable repositories in the installation, their token revoked whatever the answer.
async function reachable(
  config: GithubConfig,
  code: string,
  installationId: number,
): Promise<GithubRepository[] | null | 'exchange'> {
  const token = await exchangeCode(config, code);
  if (!token) return 'exchange';
  try {
    return await userInstallationRepositories(token, installationId);
  } finally {
    await revokeUserToken(config, token);
  }
}

/** The callback, finished: `connected`, or `failed` with nothing changed but the state spent. */
export async function finishConnect(
  db: D1Database,
  config: GithubConfig,
  planId: string,
  call: ConnectCallback,
  now: number,
): Promise<'connected' | 'failed'> {
  const claimed = await claimConnectState(db, await sha256Hex(call.secret), now);
  const person = claimed ? personOf(claimed) : null;
  if (!person) return failed('state');
  const repos = await reachable(config, call.code, call.installationId);
  if (repos === 'exchange') return failed('exchange');
  if (!repos) return failed('reach');
  const installation = await appInstallation(config, call.installationId, now);
  if (!installation || installation.suspended) return failed('installation');
  const before = await readConnection(db, planId);
  const room =
    repos.length <= REPOSITORIES_MAX
      ? await withRoom(
          config.links,
          planId,
          repos.map((r) => r.id),
        )
      : new Set<number>();
  const after: GithubConnection = {
    installationId: call.installationId,
    account: installation.account,
    connectedBy: person,
    connectedAt: now,
    repositories: repos.map((r) => ({ ...r, chosen: room.has(r.id) })),
  };
  await saveConnection(db, planId, after);
  await rewriteLinks(config.links, planId, linksOf(before), linksOf(after));
  console.info('[github] connect', {
    outcome: 'connected',
    listed: repos.length,
    chosen: room.size,
  });
  return 'connected';
}
