// The API tokens of the liveworkspace accounts Worker, for an app's e2e stack (its `scripts/e2e-stack.mjs`, which
// stands in for accounts on `/e2e/accounts`). Test-only. API tokens are made on liveworkspace.app, so a spec seeds
// one (`POST /e2e/accounts/__seed/token {userId, email?, name?, readOnly?}` → `{id, name, readOnly, expiresAt,
// secret}`), and the app's api checks it as it does in production, through the account API (account.ts:
// `/api/account/internal/tokens/verify`, `/tokens/live`, `/tokens/revoke`). Node runs this file as is (erasable
// TypeScript only), so a stack script imports it by its path.

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

export type TokenStandIn = {
  // A token as if the person made it on liveworkspace.app.
  seed(input: {
    userId: string;
    email?: string | null;
    name?: string;
    readOnly?: boolean;
  }): SeededToken;
  // The account API's token routes (`route` is the path after `/api/account/internal`), or null for another route.
  answer(route: string, body: Record<string, unknown>): { status: number; body?: unknown } | null;
  // Serves `<accountsPath>/__seed/token` and `<accountsPath>/api/account/internal/tokens/*`; false for anything else.
  serve(req: IncomingMessage, res: ServerResponse, pathname: string): boolean;
};

// `teamsOf` names the teams a token's account is in, for its `teams` claim (none by default).
export function createTokenStandIn(
  accountsPath: string,
  teamsOf: (userId: string) => StandInTeam[] = () => [],
): TokenStandIn {
  const tokens = new Map<string, Token>();
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
    const route = pathname.startsWith(`${internal}/tokens/`)
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
