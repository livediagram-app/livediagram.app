// The calls the connection makes to GitHub (docs/specs/026-plan/github-pull-requests.md "Connecting a repository";
// blueprint "Part 2" "Talking to GitHub"). Each gives up after GITHUB_FETCH_TIMEOUT_MS, and a network failure, a
// refusal or a shape it does not expect answers null, never a throw. Nothing here logs a token or a code.
import { appJwt, githubHeaders, installationToken } from './app-auth';
import { githubId } from './github-delivery';
import {
  GITHUB_API,
  GITHUB_FETCH_TIMEOUT_MS,
  GITHUB_WEB,
  INSTALLATION_REPOSITORIES_LISTED,
  REPOSITORY_PAGES_MAX,
  type GithubConfig,
} from './github-config';

/** A repository as the connection keeps it. */
export type GithubRepository = { id: number; fullName: string; private: boolean };

const FULL_NAME_MIN = 3;
const FULL_NAME_MAX = 140;

const signal = () => AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS);

async function jsonOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

function isFullName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length < FULL_NAME_MIN || name.length > FULL_NAME_MAX)
    return false;
  const slash = name.indexOf('/');
  return slash > 0 && slash < name.length - 1 && name.indexOf('/', slash + 1) === -1;
}

/** The repositories of one page of a list answer, the odd entries skipped, at most one page's worth. */
export function repositoriesOf(body: unknown): GithubRepository[] | null {
  const list = field(body, 'repositories');
  if (!Array.isArray(list)) return null;
  const out: GithubRepository[] = [];
  for (const r of list.slice(0, INSTALLATION_REPOSITORIES_LISTED)) {
    const id = githubId(field(r, 'id'));
    const fullName = field(r, 'full_name');
    if (id === undefined || !isFullName(fullName)) continue;
    out.push({ id, fullName, private: field(r, 'private') === true });
  }
  return out;
}

// One call, its failure (a throw, a timeout) logged by name only.
async function call(what: string, url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: signal() });
  } catch (err) {
    console.warn('[github] call failed', {
      what,
      error: err instanceof Error ? err.name : 'error',
    });
    return null;
  }
}

// Whether GitHub's `Link` header names a next page. Only its presence is read: the next address is built here, so a
// token is only ever sent to GITHUB_API.
const hasNextPage = (link: string | null): boolean => link?.includes('rel="next"') ?? false;

/** Every repository of a list GitHub pages (`path` with no query), at most REPOSITORY_PAGES_MAX pages,
 *  deduplicated by id; null when any page fails, since a half list would drop repositories a choice is checked
 *  against. */
async function listRepositories(
  what: string,
  path: string,
  authorization: string,
): Promise<GithubRepository[] | null> {
  const byId = new Map<number, GithubRepository>();
  for (let page = 1; page <= REPOSITORY_PAGES_MAX; page += 1) {
    const res = await call(
      what,
      `${GITHUB_API}${path}?per_page=${INSTALLATION_REPOSITORIES_LISTED}&page=${page}`,
      { headers: githubHeaders(authorization) },
    );
    if (!res?.ok) return null;
    const repos = repositoriesOf(await jsonOf(res));
    if (!repos) return null;
    for (const r of repos) if (!byId.has(r.id)) byId.set(r.id, r);
    if (!hasNextPage(res.headers.get('Link'))) return [...byId.values()];
  }
  console.warn('[github] repositories capped', { what, pages: REPOSITORY_PAGES_MAX });
  return [...byId.values()];
}

/** The person's token for the code GitHub sent back, or null. */
export async function exchangeCode(
  config: Pick<GithubConfig, 'clientId' | 'clientSecret'>,
  code: string,
): Promise<string | null> {
  const res = await call('exchange', `${GITHUB_WEB}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'liveplanner',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });
  if (!res?.ok) return null;
  const token = field(await jsonOf(res), 'access_token');
  return typeof token === 'string' && token !== '' ? token : null;
}

/** The installation's repositories the person can reach, every page, or null when they can reach none of it
 *  (GitHub's 404). */
export async function userInstallationRepositories(
  token: string,
  installationId: number,
): Promise<GithubRepository[] | null> {
  return listRepositories(
    'user_repositories',
    `/user/installations/${installationId}/repositories`,
    `Bearer ${token}`,
  );
}

/** The person's token revoked at GitHub: it was for one check. Best effort; a failure is logged. */
export async function revokeUserToken(
  config: Pick<GithubConfig, 'clientId' | 'clientSecret'>,
  token: string,
): Promise<void> {
  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const res = await call('revoke', `${GITHUB_API}/applications/${config.clientId}/token`, {
    method: 'DELETE',
    headers: { ...githubHeaders(`Basic ${basic}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token }),
  });
  if (!res || (!res.ok && res.status !== 404))
    console.warn('[github] token not revoked', { status: res?.status ?? 0 });
}

/** The installation as the App sees it: its account's login and whether it is suspended, or null. */
export async function appInstallation(
  config: Pick<GithubConfig, 'appId' | 'privateKey'>,
  installationId: number,
  now: number,
): Promise<{ account: string; suspended: boolean } | null> {
  let jwt: string;
  try {
    jwt = await appJwt(config, now);
  } catch (err) {
    console.warn('[github] app key unreadable', { error: String(err) });
    return null;
  }
  const res = await call('installation', `${GITHUB_API}/app/installations/${installationId}`, {
    headers: githubHeaders(`Bearer ${jwt}`),
  });
  if (!res?.ok) return null;
  const body = await jsonOf(res);
  const login = field(field(body, 'account'), 'login');
  if (typeof login !== 'string' || login === '' || login.length > FULL_NAME_MAX) return null;
  const suspended = field(body, 'suspended_at');
  return { account: login, suspended: suspended !== null && suspended !== undefined };
}

/** The repositories the installation sees now, every page, as the App (an installation token for this one call),
 *  or null. */
export async function installationRepositories(
  config: Pick<GithubConfig, 'appId' | 'privateKey'>,
  installationId: number,
  now: number,
): Promise<GithubRepository[] | null> {
  const token = await installationToken(config, installationId, now);
  if (!token) return null;
  return listRepositories(
    'installation_repositories',
    '/installation/repositories',
    `Bearer ${token}`,
  );
}
