// An app's server talking to the liveworkspace account API (liveworkspace/docs/accounts.md "Teams",
// "API tokens" and "Settings"), with its OAuth client credentials: checking an API token, making one
// for an AI tool someone connects, making a team for someone, reading the teams change feed,
// reading and writing someone's settings, and reading profiles and setting one's own. These send the client secret, so they run
// in the app's Worker only.
import type { SiteId } from '@liveworkspace/sites';
import type { ClientCredentials } from './oauth';

const ACCOUNT_PATH = '/api/account/internal';

export type TeamRole = 'admin' | 'member';

// A team the account is in, as its access token and a checked API token carry it.
export interface TeamClaim {
  id: string;
  name: string;
  role: TeamRole;
}

export interface TokenAccount {
  tokenId: string;
  userId: string;
  name: string;
  email: string | null;
  readOnly: boolean;
  expiresAt: number;
  teams: TeamClaim[];
}

export interface MintedToken {
  id: string;
  name: string;
  readOnly: boolean;
  expiresAt: number;
  // Shown once; never stored.
  secret: string;
}

export interface TeamChange {
  id: string;
  name: string;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MemberChange {
  id: string;
  teamId: string;
  userId: string | null;
  email: string;
  role: TeamRole;
  status: 'invited' | 'joined' | 'declined' | 'removed';
  createdAt: number;
  updatedAt: number;
}

export interface TeamChanges {
  teams: TeamChange[];
  members: MemberChange[];
  cursor: string;
  more: boolean;
}

function basic(credentials: ClientCredentials): string {
  const pair = `${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret)}`;
  return `Basic ${btoa(pair)}`;
}

async function call(
  credentials: ClientCredentials,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  fetcher: typeof fetch,
): Promise<Response> {
  return fetcher(`${credentials.accountsUrl.replace(/\/+$/, '')}${ACCOUNT_PATH}${path}`, {
    method: init.method,
    headers: {
      authorization: basic(credentials),
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function isTeamClaim(value: unknown): value is TeamClaim {
  if (!value || typeof value !== 'object') return false;
  const team = value as Record<string, unknown>;
  return (
    typeof team.id === 'string' &&
    typeof team.name === 'string' &&
    (team.role === 'admin' || team.role === 'member')
  );
}

// The teams claim from a token or a response, keeping only well-formed entries.
export function readTeamsClaim(value: unknown): TeamClaim[] | null {
  return Array.isArray(value) ? value.filter(isTeamClaim) : null;
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

export interface TokenCheckerOptions {
  // How long a token that checked out is trusted without asking again: also how long a revoked
  // token can go on working in one isolate.
  validForMs?: number;
  // How long an unknown token is refused without asking again.
  invalidForMs?: number;
  // Tokens remembered per isolate; the oldest go first.
  maxEntries?: number;
  fetcher?: typeof fetch;
  now?: () => number;
}

export const TOKEN_VALID_FOR_MS = 60_000;
export const TOKEN_INVALID_FOR_MS = 10_000;

// Checks API tokens against liveworkspace, remembering the answer per isolate so a burst of MCP calls
// costs one request, not one each. Build it once at module scope. Throws when liveworkspace can't be
// reached, so the caller can answer 503 rather than calling a good token bad.
export function createTokenChecker(
  credentials: ClientCredentials,
  options: TokenCheckerOptions = {},
) {
  const validFor = options.validForMs ?? TOKEN_VALID_FOR_MS;
  const invalidFor = options.invalidForMs ?? TOKEN_INVALID_FOR_MS;
  const maxEntries = options.maxEntries ?? 1000;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const remembered = new Map<string, { account: TokenAccount | null; until: number }>();

  return async function check(token: string): Promise<TokenAccount | null> {
    const key = await sha256(token);
    const known = remembered.get(key);
    const at = now();
    if (known && known.until > at) return known.account;
    remembered.delete(key);

    const response = await call(
      credentials,
      '/tokens/verify',
      { method: 'POST', body: { token } },
      fetcher,
    );
    let account: TokenAccount | null = null;
    if (response.ok) {
      const data = (await response.json()) as TokenAccount;
      account = { ...data, teams: readTeamsClaim(data.teams) ?? [] };
    } else if (response.status !== 404) {
      throw new Error(`token check failed: ${response.status}`);
    }
    if (remembered.size >= maxEntries) {
      const oldest = remembered.keys().next().value;
      if (oldest !== undefined) remembered.delete(oldest);
    }
    remembered.set(key, {
      account,
      until: at + (account ? Math.min(validFor, account.expiresAt - at) : invalidFor),
    });
    return account;
  };
}

// Makes an account token for an AI tool the person is connecting in this app. The app vouches for
// them with the access token it holds for them. Null when they already have the most tokens allowed.
export async function mintAccountToken(
  credentials: ClientCredentials,
  request: { accessToken: string; name: string; readOnly: boolean },
  fetcher: typeof fetch = fetch,
): Promise<MintedToken | null> {
  const response = await call(credentials, '/tokens', { method: 'POST', body: request }, fetcher);
  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`token mint failed: ${response.status}`);
  return (await response.json()) as MintedToken;
}

// A team as the account API answers one just made: the person is its admin and only member.
export interface CreatedTeam {
  id: string;
  name: string;
  organisation: string | null;
  role: TeamRole;
  memberCount: number;
  invitedCount: number;
  members: { id: string; name: string | null; email: string; role: TeamRole }[];
}

// Why making a team was refused, from the account API's error code: `name_required`, or
// `team_limit_reached` (409) at the most teams an account may be in.
export class TeamError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`team create refused: ${status} ${code}`);
    this.name = 'TeamError';
    this.status = status;
    this.code = code;
  }
}

// Makes a team for the person signed in to this app, who becomes its admin: the same team on
// liveworkspace.app and in every app. The app vouches for them with the access token it holds for
// them. Throws a TeamError when refused.
export async function createTeamFor(
  credentials: ClientCredentials,
  request: { accessToken: string; name: string; organisation?: string | null },
  fetcher: typeof fetch = fetch,
): Promise<CreatedTeam> {
  const response = await call(credentials, '/teams', { method: 'POST', body: request }, fetcher);
  if (response.status === 400 || response.status === 401 || response.status === 409) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new TeamError(response.status, error ?? 'invalid_request');
  }
  if (!response.ok) throw new Error(`team create failed: ${response.status}`);
  return (await response.json()) as CreatedTeam;
}

// A token revoking itself (a CLI signing out). False when it was already gone.
export async function revokeAccountToken(
  credentials: ClientCredentials,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const response = await call(
    credentials,
    '/tokens/revoke',
    { method: 'POST', body: { token } },
    fetcher,
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`token revoke failed: ${response.status}`);
  return true;
}

// The most ids one liveTokenIds call may ask about.
export const MAX_LIVE_TOKEN_IDS = 100;

// Which of these token ids still work, so an app can end what hangs off one revoked on
// liveworkspace.app.
export async function liveTokenIds(
  credentials: ClientCredentials,
  ids: string[],
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const response = await call(
    credentials,
    '/tokens/live',
    { method: 'POST', body: { ids } },
    fetcher,
  );
  if (!response.ok) throw new Error(`token liveness failed: ${response.status}`);
  return ((await response.json()) as { live: string[] }).live;
}

// One page of the teams change feed after `cursor` (null for the start).
export async function fetchTeamChanges(
  credentials: ClientCredentials,
  cursor: string | null,
  fetcher: typeof fetch = fetch,
): Promise<TeamChanges> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await call(credentials, `/teams/changes${query}`, { method: 'GET' }, fetcher);
  if (!response.ok) throw new Error(`team changes failed: ${response.status}`);
  return (await response.json()) as TeamChanges;
}

// --- Settings ---

// An app's site id, as @liveworkspace/sites spells it: the scope of that app's own settings.
export type SettingsApp = Exclude<SiteId, 'liveworkspace.app'>;
export type SettingsPrefs = Record<string, unknown>;

// Someone's settings as one app sees them: those every app shows, and the app's own.
export interface AccountSettings {
  all: SettingsPrefs;
  app: SettingsPrefs;
  // The later of the two scopes' last writes; null when neither has been written.
  updatedAt: number | null;
}

// Each key set to its new value, replacing it whole, or to null to delete it. Keys left out stay.
export interface SettingsPatch {
  all?: SettingsPrefs;
  app?: SettingsPrefs;
}

// Why a settings write was refused, from the account API's error code.
export class SettingsError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`settings write refused: ${status} ${code}`);
    this.name = 'SettingsError';
    this.status = status;
    this.code = code;
  }
}

// `owner` is an id the app has already verified: an access token's sub, or a guest token's.
export async function readSettings(
  credentials: ClientCredentials,
  request: { owner: string; app: SettingsApp },
  fetcher: typeof fetch = fetch,
): Promise<AccountSettings> {
  const response = await call(
    credentials,
    '/settings/read',
    { method: 'POST', body: request },
    fetcher,
  );
  if (!response.ok) throw new Error(`settings read failed: ${response.status}`);
  return (await response.json()) as AccountSettings;
}

// Applies the patch and answers the settings as they now are. A refusal (a patch that isn't an
// object of named keys, or a scope past its 16 KB) throws a SettingsError with the code.
export async function writeSettings(
  credentials: ClientCredentials,
  request: { owner: string; app: SettingsApp; patch: SettingsPatch },
  fetcher: typeof fetch = fetch,
): Promise<AccountSettings> {
  const response = await call(
    credentials,
    '/settings/write',
    { method: 'POST', body: request },
    fetcher,
  );
  if (response.status === 400 || response.status === 413) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SettingsError(response.status, error ?? 'invalid_request');
  }
  if (!response.ok) throw new Error(`settings write failed: ${response.status}`);
  return (await response.json()) as AccountSettings;
}

// --- Profiles ---

// A person's display name and presence colour, the same in every app. An account shows its account
// name until it sets a display name; `name` and `color` may be null (no name, or the app's own pick of
// colour), and the times are null for an account that never set either.
export interface Profile {
  id: string;
  name: string | null;
  color: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

// A string sets the field, null clears it, and a field left out stays.
export interface ProfilePatch {
  name?: string | null;
  color?: string | null;
}

// The most ids the account API takes in one read; readProfiles splits a longer list.
export const MAX_PROFILE_IDS = 100;

// Why a profile write was refused, from the account API's error code: `invalid_name`,
// `invalid_color`, `nothing_to_change` or `invalid_owner` (400), or `unknown_owner` (404).
export class ProfileError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`profile write refused: ${status} ${code}`);
    this.name = 'ProfileError';
    this.status = status;
    this.code = code;
  }
}

// The profiles of these owners (account or guest ids the app has seen), for a presence list or a
// page of comments. Repeated ids are asked once, and a list over MAX_PROFILE_IDS goes in batches of
// that many, at once. An id with neither a profile nor an account is left out of the answer.
export async function readProfiles(
  credentials: ClientCredentials,
  ids: string[],
  fetcher: typeof fetch = fetch,
): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let at = 0; at < unique.length; at += MAX_PROFILE_IDS) {
    batches.push(unique.slice(at, at + MAX_PROFILE_IDS));
  }
  const pages = await Promise.all(
    batches.map(async (batch) => {
      const response = await call(
        credentials,
        '/profiles/read',
        { method: 'POST', body: { ids: batch } },
        fetcher,
      );
      if (!response.ok) throw new Error(`profiles read failed: ${response.status}`);
      return ((await response.json()) as { profiles: Profile[] }).profiles;
    }),
  );
  return pages.flat();
}

// Sets someone's own name or colour. `owner` is an id the app has already verified as the person
// asking (an access token's sub, or a guest token's). Answers the profile as it now is.
export async function writeProfile(
  credentials: ClientCredentials,
  request: { owner: string } & ProfilePatch,
  fetcher: typeof fetch = fetch,
): Promise<Profile> {
  const response = await call(
    credentials,
    '/profiles/write',
    { method: 'POST', body: request },
    fetcher,
  );
  if (response.status === 400 || response.status === 404) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ProfileError(response.status, error ?? 'invalid_request');
  }
  if (!response.ok) throw new Error(`profile write failed: ${response.status}`);
  return ((await response.json()) as { profile: Profile }).profile;
}
