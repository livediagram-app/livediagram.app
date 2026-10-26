// The API tokens and profiles of the liveworkspace accounts Worker, for an app's e2e stack (its
// `scripts/e2e-stack.mjs`, which stands in for accounts on `/e2e/accounts`), shared by all four apps' stacks.
// Test-only. Node runs this file as is (erasable TypeScript only), so a stack script imports it by its path.
//
// - API tokens are made on liveworkspace.app, so a spec seeds one (`POST /e2e/accounts/__seed/token {userId,
//   email?, name?, readOnly?}` → `{id, name, readOnly, expiresAt, secret}`), and the app's api checks it as it
//   does in production, through the account API (account.ts: `/api/account/internal/tokens/verify`,
//   `/tokens/live`, `/tokens/revoke`). An app connecting an AI tool makes one through the same API (`/tokens
//   {accessToken, name, readOnly}`), for the person its access token names, as the accounts Worker does.
// - Profiles (display names and colours, liveworkspace/docs/accounts.md "Profiles") are kept in memory: the api
//   writes one when someone sets their name (`/profiles/write {owner, name?, color?}`) and reads them for
//   presence, comments and changeset toasts (`/profiles/read {ids}`), as against the accounts Worker. An id
//   nobody wrote a profile for is left out of a read, so the app falls back to its own default name.

import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type StandInTeam = { id: string; name: string; role: string };

type Token = {
  id: string;
  userId: string;
  email: string | null;
  name: string;
  readOnly: boolean;
  expiresAt: number;
  revoked: boolean;
};

export type SeededToken = {
  id: string;
  name: string;
  readOnly: boolean;
  expiresAt: number;
  secret: string;
};

const TOKEN_LIFE_MS = 90 * 24 * 60 * 60 * 1000;

// A profile as the account API answers it (account.ts `Profile`).
export type StandInProfile = {
  id: string;
  name: string | null;
  color: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

// The accounts Worker's limits (liveworkspace/apps/accounts/src/profiles.ts), so a spec meets the same refusals.
const MAX_PROFILE_IDS = 100;
const PROFILE_NAME_MAX = 120;
const PROFILE_COLOR_MAX = 64;
const PROFILE_OWNER = /^(user|guest)_[A-Za-z0-9_-]+$/;

export type TokenStandIn = {
  // A token as if the person made it on liveworkspace.app.
  seed(input: {
    userId: string;
    email?: string | null;
    name?: string;
    readOnly?: boolean;
  }): SeededToken;
  // The account API's token and profile routes (`route` is the path after `/api/account/internal`), or null for
  // another route.
  answer(route: string, body: Record<string, unknown>): { status: number; body?: unknown } | null;
  // Serves `<accountsPath>/__seed/token`, `<accountsPath>/api/account/internal/tokens/*` and `…/profiles/*`; false
  // for anything else.
  serve(req: IncomingMessage, res: ServerResponse, pathname: string): boolean;
};

// `teamsOf` names the teams a token's account is in, for its `teams` claim (none by default).
export function createTokenStandIn(
  accountsPath: string,
  teamsOf: (userId: string) => StandInTeam[] = () => [],
): TokenStandIn {
  const tokens = new Map<string, Token>();
  const profiles = new Map<string, StandInProfile>();
  const seed: TokenStandIn['seed'] = ({
    userId,
    email = null,
    name = 'API token',
    readOnly = false,
  }) => {
    const secret = `lwt_${randomBytes(32).toString('base64url')}`;
    const token: Token = {
      id: randomUUID(),
      userId,
      email,
      name,
      readOnly,
      expiresAt: Date.now() + TOKEN_LIFE_MS,
      revoked: false,
    };
    tokens.set(secret, token);
    return { id: token.id, name, readOnly, expiresAt: token.expiresAt, secret };
  };
  const answer: TokenStandIn['answer'] = (route, body) => {
    // A token for an AI tool someone is connecting in an app (account.ts `mintAccountToken`). The accounts Worker
    // checks the app's access token; the stack minted it, so the stand-in reads the person from it.
    if (route === '/tokens') {
      const person = accessTokenSubject(body.accessToken);
      if (!person) return { status: 401, body: { error: 'invalid_token' } };
      const name =
        typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'MCP client';
      return {
        status: 201,
        body: seed({
          userId: person.sub,
          email: person.email,
          name,
          readOnly: body.readOnly === true,
        }),
      };
    }
    if (route === '/tokens/verify') {
      const token = tokens.get(String(body.token ?? ''));
      if (!token || token.revoked || token.expiresAt <= Date.now()) {
        return { status: 404, body: { error: 'unknown_token' } };
      }
      return {
        status: 200,
        body: {
          tokenId: token.id,
          userId: token.userId,
          name: token.name,
          email: token.email,
          readOnly: token.readOnly,
          expiresAt: token.expiresAt,
          teams: teamsOf(token.userId),
        },
      };
    }
    if (route === '/tokens/revoke') {
      const token = tokens.get(String(body.token ?? ''));
      if (!token || token.revoked) return { status: 404, body: { error: 'unknown_token' } };
      token.revoked = true;
      return { status: 204 };
    }
    if (route === '/profiles/read') {
      const ids = body.ids;
      if (
        !Array.isArray(ids) ||
        !ids.every((id) => typeof id === 'string' && PROFILE_OWNER.test(id))
      ) {
        return { status: 400, body: { error: 'ids_required' } };
      }
      if (ids.length > MAX_PROFILE_IDS) return { status: 400, body: { error: 'too_many_ids' } };
      const found = [...new Set(ids as string[])].flatMap((id) => profiles.get(id) ?? []);
      return { status: 200, body: { profiles: found } };
    }
    if (route === '/profiles/write') {
      const owner = body.owner;
      if (typeof owner !== 'string' || !PROFILE_OWNER.test(owner)) {
        return { status: 400, body: { error: 'invalid_owner' } };
      }
      const name = cleaned(body.name, PROFILE_NAME_MAX);
      if (name === false) return { status: 400, body: { error: 'invalid_name' } };
      const color = cleaned(body.color, PROFILE_COLOR_MAX);
      if (color === false) return { status: 400, body: { error: 'invalid_color' } };
      if (name === undefined && color === undefined) {
        return { status: 400, body: { error: 'nothing_to_change' } };
      }
      const now = Date.now();
      const prior = profiles.get(owner);
      const profile: StandInProfile = {
        id: owner,
        name: name === undefined ? (prior?.name ?? null) : name,
        color: color === undefined ? (prior?.color ?? null) : color,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
      };
      profiles.set(owner, profile);
      return { status: 200, body: { profile } };
    }
    if (route === '/tokens/live') {
      const live = new Set(
        [...tokens.values()].filter((t) => !t.revoked && t.expiresAt > Date.now()).map((t) => t.id),
      );
      const ids = Array.isArray(body.ids) ? body.ids : [];
      return { status: 200, body: { live: ids.filter((id) => live.has(String(id))) } };
    }
    return null;
  };
  const internal = `${accountsPath}/api/account/internal`;
  const seedPath = `${accountsPath}/__seed/token`;
  const serve: TokenStandIn['serve'] = (req, res, pathname) => {
    const route =
      pathname === `${internal}/tokens` ||
      pathname.startsWith(`${internal}/tokens/`) ||
      pathname.startsWith(`${internal}/profiles/`)
        ? pathname.slice(internal.length)
        : null;
    if (pathname !== seedPath && route === null) return false;
    readJson(req)
      .then((body) => {
        if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
        if (pathname === seedPath) {
          if (typeof body.userId !== 'string') return send(res, 400, { error: 'user_required' });
          return send(
            res,
            200,
            seed({
              userId: body.userId,
              email: typeof body.email === 'string' ? body.email : null,
              ...(typeof body.name === 'string' ? { name: body.name } : {}),
              readOnly: body.readOnly === true,
            }),
          );
        }
        const answered = answer(route!, body);
        return answered
          ? send(res, answered.status, answered.body)
          : send(res, 404, { error: 'not_found' });
      })
      .catch(() => send(res, 400, { error: 'invalid_json' }));
    return true;
  };
  return { seed, answer, serve };
}

// The person an access token names (its `sub`, and its email when verified), read without checking the signature:
// only the stack that minted it talks to the stand-in. Null for anything that is not a JWT naming an account.
function accessTokenSubject(token: unknown): { sub: string; email: string | null } | null {
  if (typeof token !== 'string') return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (typeof claims.sub !== 'string' || !claims.sub.startsWith('user_')) return null;
    const email =
      typeof claims.email === 'string' && claims.email_verified === true ? claims.email : null;
    return { sub: claims.sub, email };
  } catch {
    return null;
  }
}

// A profile field as the accounts Worker cleans it: left out (undefined), cleared (null, or blank once
// trimmed), a trimmed string, or false when it isn't one it takes.
function cleaned(value: unknown, max: number): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (text.length > max) return false;
  return text || null;
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        const value: unknown = text ? JSON.parse(text) : {};
        resolve(value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
