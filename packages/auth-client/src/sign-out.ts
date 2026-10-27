// The page's side of signing out of an app, which signs the person out everywhere in this browser
// (liveworkspace/docs/specs/003-accounts/accounts.md "Signing out"). The app's API ends its own session and the
// liveworkspace one, and answers the hop through liveworkspace.app the page then takes to clear its cookie there; safe
// in the browser, with no secrets.

export interface SignOutAnswer {
  // Whether the app's API signed out (false: it refused or couldn't be reached, and nothing changed).
  ok: boolean;
  // The accounts site's hop, coming back to `returnTo`; null when there is none to take.
  next: string | null;
}

// Asks the app's API on this page's own origin to sign out, coming back to `returnTo` (a path on this site).
export async function askSignOut(
  returnTo: string,
  { apiBase = '/api', fetchImpl = fetch }: { apiBase?: string; fetchImpl?: typeof fetch } = {},
): Promise<SignOutAnswer> {
  try {
    const response = await fetchImpl(
      `${apiBase}/auth/sign-out?return=${encodeURIComponent(returnTo)}`,
      { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json' } },
    );
    if (!response.ok) return { ok: false, next: null };
    const body = (await response.json().catch(() => null)) as { next?: unknown } | null;
    const next =
      typeof body?.next === 'string' && /^https?:\/\//.test(body.next) ? body.next : null;
    return { ok: true, next };
  } catch {
    return { ok: false, next: null };
  }
}
