// The page's ask for an access token (POST <api>/auth/token, app-auth.ts `token`), read into one of three answers
// (liveworkspace/docs/specs/003-accounts/accounts.md "An answer that never came"): signed in, signed out, or unknown.
// Only the api's own word is "signed out": a 401 with `signedIn: false`, or an ok answer saying so. A request that
// fails, times out, or answers anything else (a 5xx, a 408 or 429, a body that is not the answer) is unknown: the
// session may well be there, so the page asks again rather than settling as a guest, whose reads of the person's
// private items would answer not found.

// `tokenAgeMs`: how old the session's ID token is, by the api's clock, when the api says (app-auth.ts `tokenAge`).
export type TokenSession<User> = {
  accessToken: string;
  expiresAt: number;
  user: User;
  tokenAgeMs?: number;
};

export type TokenAnswer<Session> =
  | { kind: 'signed-in'; session: Session }
  | { kind: 'signed-out' }
  | { kind: 'unknown'; reason: string };

/** How long one ask waits before it counts as unknown. A refresh that stalls upstream must not hold the page. */
export const TOKEN_TIMEOUT_MS = 10_000;

/** The waits between asks while the answer stays unknown: quick at first, then every 15 s until one comes. */
export const TOKEN_RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 15_000];

type Body = {
  signedIn?: boolean;
  accessToken?: string;
  expiresAt?: number;
  user?: { id?: string };
  tokenAgeMs?: unknown;
};

/** Ask once. Never rejects. */
export async function askToken<User extends { id: string }>(
  apiBase: string,
  deps: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<TokenAnswer<TokenSession<User>>> {
  const doFetch = deps.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TOKEN_TIMEOUT_MS);
  try {
    const res = await doFetch(`${apiBase}/auth/token`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    let body: Body | null = null;
    try {
      body = (await res.json()) as Body;
    } catch {
      body = null;
    }
    if (body?.signedIn === false && (res.ok || res.status === 401)) return { kind: 'signed-out' };
    if (res.ok && body?.signedIn === true && body.accessToken && body.user?.id) {
      return {
        kind: 'signed-in',
        session: {
          accessToken: body.accessToken,
          expiresAt: body.expiresAt ?? 0,
          user: body.user as User,
          ...(typeof body.tokenAgeMs === 'number' ? { tokenAgeMs: body.tokenAgeMs } : {}),
        },
      };
    }
    return { kind: 'unknown', reason: `status ${res.status}` };
  } catch (err) {
    return {
      kind: 'unknown',
      reason: controller.signal.aborted ? 'timeout' : err instanceof Error ? err.name : 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Ask until the api says signed in or signed out, waiting `delays` between asks (the last repeats). For the page's
 *  first answer, which decides who is reading: an unknown one never settles as signed out. */
export async function askTokenUntilKnown<Session>(
  ask: () => Promise<TokenAnswer<Session>>,
  deps: {
    delays?: readonly number[];
    wait?: (ms: number) => Promise<void>;
    onUnknown?: (reason: string, attempt: number) => void;
  } = {},
): Promise<Exclude<TokenAnswer<Session>, { kind: 'unknown' }>> {
  const delays = deps.delays ?? TOKEN_RETRY_DELAYS_MS;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    const answer = await ask();
    if (answer.kind !== 'unknown') return answer;
    deps.onUnknown?.(answer.reason, attempt);
    await wait(delays[Math.min(attempt, delays.length - 1)]!);
  }
}
