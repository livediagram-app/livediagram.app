// The two bearer credentials every product's api reads after a person's own token (each product's
// apps/api/src/index.ts, docs/specs/015-api/public-api-and-tokens.md and docs/specs/013-workspace/workbench-embeds.md):
// an API token and a workbench session. Each product binds these once at module scope to its own lookups,
// formats and response helpers, so the rule of what is refused, and how, is one copy.

// What both readers need from the api: its JSON response (with its CORS headers), its 503 for when
// liveworkspace can't answer, and the error that lookup throws then.
export type BearerResponses = {
  json: (body: unknown, init?: ResponseInit) => Response;
  // liveworkspace can't say whether a credential is good: neither good nor bad, so a client retries rather than
  // drops it.
  unavailable: () => Response;
  isUnavailable: (err: unknown) => boolean;
};

// A bearer read: the credential it resolved (null when the bearer is not one), or the response that refuses it.
export type BearerRead<T> = { ok: true; value: T | null } | { ok: false; response: Response };

const invalidBearer = (responses: BearerResponses, error: string): Response =>
  responses.json(
    { error },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
  );

export type TokenBearerDeps<Env, Token> = BearerResponses & {
  hasTokenPrefix: (bearer: string) => boolean;
  isTokenFormat: (bearer: string) => boolean;
  resolve: (env: Env, bearer: string) => Promise<Token | null>;
};

// API token (docs/specs/015-api/public-api-and-tokens.md): a `Bearer lwt_…` resolves to its owner, always an
// account, via the hashed-token lookup. A bearer that carries the token prefix claims to be a token even when it
// is cut short or mistyped (a copy-paste slip): it is refused as one, never read as a guest or handed to the
// account path. The token is the liveworkspace account's, checked with liveworkspace: when liveworkspace can't
// answer, the token is neither good nor bad, 503, so a client retries rather than drops its credential. Unknown,
// revoked or expired, it is refused (§3.3).
export function createTokenBearer<Env, Token>(deps: TokenBearerDeps<Env, Token>) {
  return async (env: Env, bearer: string | null, path: string): Promise<BearerRead<Token>> => {
    if (!bearer || !deps.hasTokenPrefix(bearer)) return { ok: true, value: null };
    let token: Token | null;
    try {
      token = deps.isTokenFormat(bearer) ? await deps.resolve(env, bearer) : null;
    } catch (err) {
      if (!deps.isUnavailable(err)) throw err;
      return { ok: false, response: deps.unavailable() };
    }
    if (!token) {
      console.warn('[tokens] invalid bearer refused', { path });
      return { ok: false, response: invalidBearer(deps, 'invalid_token') };
    }
    return { ok: true, value: token };
  };
}

// How a product looks a workbench session up, and the rule that confines a resolved one.
export type WorkbenchBearerDeps<Env, Workbench> = BearerResponses & {
  sessionPrefix: string;
  isSessionFormat: (bearer: string) => boolean;
  resolve: (
    env: Env,
    bearer: string,
  ) => Promise<
    | { ok: true; workbench: Workbench }
    | { ok: false; reason: string; sessionPrefix?: string | undefined }
  >;
  refusal: (
    workbench: Workbench,
    method: string,
    segments: readonly string[],
    headers: Headers,
  ) => Response | null;
};

// Workbench session (docs/specs/013-workspace/workbench-embeds.md): a `Bearer lvw_…` is a person's editor on one
// file, minted from their token's ticket. A session-shaped bearer that does not resolve is refused, never read as
// a guest; cut short or mistyped, it is refused as a session too (as a token is). When liveworkspace can't
// answer, the session is neither good nor bad: 503, as for a token. A resolved one is confined at once (the
// product's auth/workbench-confinement.ts): another file reads as absent, any route outside the allow-list is
// refused, and a view session writes nothing.
export function createWorkbenchBearer<Env, Workbench>(deps: WorkbenchBearerDeps<Env, Workbench>) {
  return async (
    env: Env,
    bearer: string | null,
    segments: readonly string[],
    request: Request,
  ): Promise<BearerRead<Workbench>> => {
    if (!bearer?.startsWith(deps.sessionPrefix)) return { ok: true, value: null };
    let resolved: Awaited<ReturnType<typeof deps.resolve>>;
    try {
      resolved = deps.isSessionFormat(bearer)
        ? await deps.resolve(env, bearer)
        : { ok: false, reason: 'malformed', sessionPrefix: '' };
    } catch (err) {
      if (!deps.isUnavailable(err)) throw err;
      return { ok: false, response: deps.unavailable() };
    }
    if (!resolved.ok) {
      console.warn('[workbench] bearer-refused', {
        reason: resolved.reason,
        sessionPrefix: resolved.sessionPrefix,
      });
      return { ok: false, response: invalidBearer(deps, 'invalid_session') };
    }
    const refusal = deps.refusal(resolved.workbench, request.method, segments, request.headers);
    if (refusal) return { ok: false, response: refusal };
    return { ok: true, value: resolved.workbench };
  };
}
