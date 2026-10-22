// The sign-in pages' side of the accounts API (liveworkspace/apps/accounts), which answers on this
// same origin under /api/auth.

export const ACCOUNTS_API = '/api/auth';

// What the pages need to know about this deployment (the Worker's src/sign-in-options.ts).
export interface SignInOptions {
  turnstileSiteKey: string;
  google: boolean;
  nameMaxLength: number;
}

export interface CallResult {
  ok: boolean;
  status: number;
  // The response's JSON, or {} when it had none.
  data: Record<string, unknown>;
}

// A GET without a body, a POST with one. Better Auth refuses a POST that isn't JSON from this origin.
export async function call(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<CallResult> {
  try {
    const response = await fetch(ACCOUNTS_API + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
    };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

// The `url` a sign-in, consent or continue answers with: where the browser goes next.
export function nextUrl(result: CallResult): string | null {
  return result.ok && typeof result.data.url === 'string' ? result.data.url : null;
}

// Rebuilds the signed OAuth query the provider put on the page's URL, in the form the sign-in and
// consent endpoints expect as `oauth_query`. A port of @better-auth/oauth-provider's
// buildSignedOAuthQuery (src/signed-query.ts); its client does the same, but would ship far more.
export function signedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (!params.has('sig')) return undefined;
  const names = params.getAll('ba_param');
  if (names.length === 0) return undefined;
  const allowed = new Set(names);
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || allowed.has(key)) out.append(key, value);
  }
  return out.toString();
}

// An app's "Create account" asks with prompt=create, and the provider keeps sending that request
// back to the registration page until it hears the account was made.
export function isRegistering(search: string): boolean {
  return (new URLSearchParams(search).get('prompt') ?? '').split(' ').includes('create');
}

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Where a sign-in started from the site's header goes back to: the `return` path it carries, if
// it's a path on this site. Anything else (another origin, `//host`, a backslash trick) is ignored,
// so the parameter can't send anyone off-site.
export const RETURN_PARAM = 'return';

export function returnPath(search: string): string | null {
  const path = new URLSearchParams(search).get(RETURN_PARAM);
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return path;
}

// The sign-in link for a page: back to that page once signed in.
export function signInHref(here: string): string {
  return `/sign-in?${RETURN_PARAM}=${encodeURIComponent(here)}`;
}

// The name the header shows for a signed-in account.
export function displayName(user: Record<string, unknown>): string {
  for (const key of ['givenName', 'name', 'email']) {
    const value = user[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Your account';
}
