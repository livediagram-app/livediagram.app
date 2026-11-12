// The plan's GitHub connection routes as the Automations screen calls them (docs/specs/026-plan/github-pull-requests.md
// "Connecting a repository"; blueprint "Part 2" "The plan's routes"): the connection, a connect's start (GitHub's
// install page to go to), the repositories chosen, and a disconnect. Every one is a signed-in Editor's of the whole
// plan; anyone else is refused `github_needs_editor`, thrown as GithubRefusal so the view can say so.

import type {
  GithubConnectionResponse,
  GithubConnectionView,
  GithubConnectStartResponse,
  GithubRepositoriesRequest,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';
import type { AutomationsScope } from '../automations-client';

/** The api's named refusals: not an Editor in person, not connected, a repository gone or full, GitHub away. */
export const GITHUB_REFUSALS = [
  'github_needs_editor',
  'github_not_connected',
  'github_invalid',
  'github_repository_gone',
  'github_repository_full',
  'github_unavailable',
] as const;
export type GithubRefusalCode = (typeof GITHUB_REFUSALS)[number];

export class GithubRefusal extends Error {
  readonly status: number;
  readonly code: GithubRefusalCode;
  constructor(status: number, code: GithubRefusalCode) {
    super(code);
    this.name = 'GithubRefusal';
    this.status = status;
    this.code = code;
  }
}

async function refusalOf(res: Response): Promise<GithubRefusal | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    const code = body.error;
    return typeof code === 'string' && (GITHUB_REFUSALS as readonly string[]).includes(code)
      ? new GithubRefusal(res.status, code as GithubRefusalCode)
      : null;
  } catch {
    return null;
  }
}

async function call<T>(
  scope: AutomationsScope,
  rest: string,
  action: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await apiFetch(
    `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/github${rest}`,
    {
      method: init.method ?? 'GET',
      headers: await apiHeaders(scope.ownerId, {
        share: scope.shareCode,
        body: init.body !== undefined,
      }),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    },
  );
  if (!res.ok) {
    const refusal = await refusalOf(res);
    if (refusal) throw refusal;
  }
  if (res.status === 204) {
    await expectOkVoid(res, action);
    return undefined as T;
  }
  return expectOk<T>(res, action);
}

export const readGithub = async (scope: AutomationsScope): Promise<GithubConnectionView | null> =>
  (await call<GithubConnectionResponse>(scope, '', 'github')).connection;

/** The install page on GitHub, carrying a one-time state that names this plan. */
export const startGithubConnect = async (scope: AutomationsScope): Promise<string> =>
  (await call<GithubConnectStartResponse>(scope, '/connect', 'github connect', { method: 'POST' }))
    .url;

export const chooseGithubRepositories = async (
  scope: AutomationsScope,
  ids: readonly number[],
): Promise<GithubConnectionView | null> =>
  (
    await call<GithubConnectionResponse>(scope, '/repositories', 'github repositories', {
      method: 'PUT',
      body: { ids: [...ids] } satisfies GithubRepositoriesRequest,
    })
  ).connection;

export const disconnectGithub = (scope: AutomationsScope): Promise<void> =>
  call<void>(scope, '', 'github disconnect', { method: 'DELETE' });
