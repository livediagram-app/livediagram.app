// Who is asking (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Reaching the index"):
//   - a person, by an accounts access token or a guest token, checked offline against accounts' keys;
//   - an app's server acting for an account it checked itself (an API token's), by its key, X-Index-App and
//     X-Index-Person: that account, for that app's items only;
//   - a link visitor, by a share code (and its password), with or without a person;
//   - an app's server, by its key and X-Index-App (and livediagram's, for the migration's handoff, naming a guest or
//     an account in X-Index-Person: handoffPersonOf);
//   - accounts, by the merge key: its own internal calls, and acting for an account it checked itself (a workbench's
//     token) as an app's server does, for the app X-Index-App names;
//   - the Google Drive mirror's service, by its key, X-Index-App: drive and X-Index-Person: that account, for
//     their personal items and folders only, in every app (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index");
//   - the data export's service, by its key, X-Index-App: export and X-Index-Person: that account, listing their
//     personal items, or one team's they administer (X-Index-Teams), in every app
//     (liveworkspace/docs/specs/003-accounts/data-export.md "Contracts > The index").

import { createPersonVerifier } from '@liveworkspace/auth-client';
import {
  DELEGATED_TEAMS_MAX,
  INDEX_APP_HEADER,
  INDEX_PERSON_HEADER,
  INDEX_TEAMS_HEADER,
  isApp,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  type App,
} from '@liveworkspace/index-client';
import { isId, isShareCode } from './codec';
import { guessVisitorOf } from './share-guesses';
import { accountsUrl, appKey, audiences, type Env } from './env';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';

export type Person = {
  id: string;
  kind: 'account' | 'guest';
  // The teams the person has joined, from their token's claim. A guest has none.
  teams: string[];
  // Set when an app's server acts for the person: only that app's items are theirs to reach here.
  app?: App;
  // Set when the Drive mirror acts for the person: only their personal items (any app's) and their own folders
  // are theirs to reach here, never a team's or one shared with them. Their teams are always empty.
  drive?: true;
  // Set when the data export's service acts for the person: it lists one scope's items alone, their personal items
  // or the one team in `teams` (accounts checked they administer it), never one shared with them.
  export?: true;
};

// `visitor`: the network a password guess is counted against (share-guesses.ts), null when the request can't say.
export type ShareCredentials = { code: string; password: string | null; visitor: string | null };

export type Caller = { person: Person | null; share: ShareCredentials | null };

type Verify = ReturnType<typeof createPersonVerifier>;

// One verifier per issuer and audience list for the life of the isolate: it caches accounts' key set.
const verifiers = new Map<string, Verify>();

function verifierFor(env: Env): Verify | null {
  const list = audiences(env);
  if (list.length === 0) return null;
  const issuer = `${accountsUrl(env)}/api/auth`;
  const key = `${issuer} ${list.join(',')}`;
  let verify = verifiers.get(key);
  if (!verify) {
    verify = createPersonVerifier({ issuer, audience: list });
    verifiers.set(key, verify);
  }
  return verify;
}

export const bearerOf = (request: Request): string | null =>
  request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

// The person a request's bearer token names, or null for none (or one that doesn't check out).
export async function personOf(request: Request, env: Env): Promise<Person | null> {
  const token = bearerOf(request);
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  const claims = await verify(token);
  if (!claims) return null;
  if (claims.kind === 'guest') return { id: claims.guestId, kind: 'guest', teams: [] };
  return {
    id: claims.userId,
    kind: 'account',
    teams: (claims.teams ?? []).map((team) => team.id),
  };
}

export function shareOf(request: Request): ShareCredentials | null {
  const code = request.headers.get(SHARE_CODE_HEADER);
  if (!isShareCode(code)) return null;
  const password = request.headers.get(SHARE_PASSWORD_HEADER);
  return { code: code.toUpperCase(), password: password || null, visitor: guessVisitorOf(request) };
}

// What the Drive mirror's service names itself in X-Index-App when it acts for a person.
export const DRIVE_DELEGATE = 'drive';

// What the data export's service names itself in X-Index-App when it acts for a person.
export const EXPORT_DELEGATE = 'export';

// The account an app's server acts for, or null when the request names none. A request that names one without
// the app's key, or names a guest or a malformed id, is refused rather than read as nobody. The Drive mirror's
// service naming a guest is `guest` (403): its key is right, the person can't be mirrored.
export async function delegatedPersonOf(
  request: Request,
  env: Env,
): Promise<Person | null | 'refused' | 'guest'> {
  const personId = request.headers.get(INDEX_PERSON_HEADER);
  if (personId === null) return null;
  if (request.headers.get(INDEX_APP_HEADER) === DRIVE_DELEGATE) {
    if (!(await isDriveCaller(request, env))) return 'refused';
    if (personId.startsWith('guest_')) return 'guest';
    if (!isId(personId) || personId.includes(':')) return 'refused';
    // X-Index-Teams is ignored: a team's items are never the mirror's.
    return { id: personId, kind: 'account', teams: [], drive: true };
  }
  if (request.headers.get(INDEX_APP_HEADER) === EXPORT_DELEGATE) {
    if (!(await isExportCaller(request, env))) return 'refused';
    if (personId.startsWith('guest_')) return 'guest';
    if (!isId(personId) || personId.includes(':')) return 'refused';
    // One team at most: the export's scope is one space.
    const named = (request.headers.get(INDEX_TEAMS_HEADER) ?? '').trim();
    if (named !== '' && (!isId(named) || named.includes(','))) return 'refused';
    return { id: personId, kind: 'account', teams: named ? [named] : [], export: true };
  }
  // The app's own key, or accounts' (its workbench service acting for a token's account on one app's items,
  // liveworkspace/docs/specs/011-workbench/workbench.md).
  const app = (await callerApp(request, env)) ?? (await mergeDelegateApp(request, env));
  // An account only: a guest has no API token, and a link visitor is no person.
  if (!app || !isId(personId) || personId.startsWith('guest_') || personId.includes(':')) {
    return 'refused';
  }
  const teams = (request.headers.get(INDEX_TEAMS_HEADER) ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (teams.length > DELEGATED_TEAMS_MAX || !teams.every(isId)) return 'refused';
  return { id: personId, kind: 'account', teams, app };
}

// The caller, null for a refused delegate (401), or `guest` for the Drive mirror naming a guest (403).
export async function callerOf(request: Request, env: Env): Promise<Caller | null | 'guest'> {
  const delegated = await delegatedPersonOf(request, env);
  if (delegated === 'refused') return null;
  if (delegated === 'guest') return 'guest';
  // Neither the mirror nor the export ever comes in through a link.
  if (delegated?.drive || delegated?.export) return { person: delegated, share: null };
  return { person: delegated ?? (await personOf(request, env)), share: shareOf(request) };
}

// The app this request speaks for, or null when it doesn't carry that app's key.
export async function callerApp(request: Request, env: Env): Promise<App | null> {
  const app = request.headers.get(INDEX_APP_HEADER);
  if (!isApp(app)) return null;
  const expected = appKey(env, app);
  const token = bearerOf(request);
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

// The app accounts names when it acts for a person with its merge key, or null for a request that isn't that.
async function mergeDelegateApp(request: Request, env: Env): Promise<App | null> {
  const app = request.headers.get(INDEX_APP_HEADER);
  if (!isApp(app)) return null;
  return (await isMergeCaller(request, env)) ? app : null;
}

// A new guest's id, as accounts mints it: `guest_` and a lowercase UUID.
const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The person livediagram's api hands a migration part off for (migration-handoff.ts), from X-Index-Person: an
// account, or on that route alone a guest, since a browser's Local only documents are usually a guest's. The
// caller has already been checked for an app's key; X-Index-Teams is ignored (the item goes in no team). Null for
// a missing or malformed id.
export function handoffPersonOf(request: Request): string | null {
  const personId = request.headers.get(INDEX_PERSON_HEADER);
  if (!isId(personId) || personId.includes(':')) return null;
  if (personId.startsWith('guest_')) return GUEST_ID.test(personId) ? personId : null;
  return personId;
}

// Whether a request carries the Drive mirror's key (INDEX_KEY_DRIVE).
export async function isDriveCaller(request: Request, env: Env): Promise<boolean> {
  const expected = env.INDEX_KEY_DRIVE?.trim();
  const token = bearerOf(request);
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}

// Whether a request carries the data export service's key (INDEX_KEY_EXPORT).
export async function isExportCaller(request: Request, env: Env): Promise<boolean> {
  const expected = env.INDEX_KEY_EXPORT?.trim();
  const token = bearerOf(request);
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}

export async function isMergeCaller(request: Request, env: Env): Promise<boolean> {
  const expected = env.MERGE_KEY?.trim();
  const token = bearerOf(request);
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}

// The spaces a person's own things live in: theirs, and each team they have joined.
export const personalScope = (personId: string) => `p:${personId}`;
export const teamScope = (teamId: string) => `t:${teamId}`;
export const scopeOf = (ownerId: string, teamId: string | null) =>
  teamId ? teamScope(teamId) : personalScope(ownerId);

export function scopesOf(person: Person): string[] {
  return [personalScope(person.id), ...person.teams.map(teamScope)];
}
