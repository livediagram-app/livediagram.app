// The address an invitation was sent to, for the sign-in and sign-up forms (liveworkspace/docs/specs/003-accounts/
// accounts.md "Invitations"). The invitation email's link carries the invitation's own token, never the address:
// the Explorer's Invites reads the address with it, keeps it in the tab's sessionStorage and takes the token out of
// the address bar, and the forms fill it in. So the address rides in no URL, Referer or log.

import { accountApi } from './account-api';

/** The query parameter the invitation email's link carries. */
export const INVITE_PARAM = 'invite';

/** Where the tab keeps the invited address until a form takes it. */
export const INVITED_ADDRESS_KEY = 'liveworkspace:invited-address';

// The same shape as a decline token (lib/teams.ts joinTokenFrom): anything else is never sent.
const TOKEN = /^[\w.-]{1,200}$/;
// Long enough for any real address, short enough that nothing odd lands in a form.
const ADDRESS_MAX = 320;

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The invited address the tab holds, or null. */
export function invitedAddress(): string | null {
  const address = session()?.getItem(INVITED_ADDRESS_KEY) ?? null;
  return address && address.length <= ADDRESS_MAX && address.includes('@') ? address : null;
}

/** Once signed in, the tab forgets it. */
export function forgetInvitedAddress(): void {
  try {
    session()?.removeItem(INVITED_ADDRESS_KEY);
  } catch {
    // No storage: nothing kept.
  }
}

function keep(address: string): void {
  try {
    session()?.setItem(INVITED_ADDRESS_KEY, address);
  } catch {
    // No storage: the form starts empty, as before.
  }
}

/**
 * On a page opened from an invitation email (`?invite=<token>`): takes the token out of the address bar at once,
 * whoever is reading, and when `signedOut` reads the invited address with it and keeps it for the forms. Resolves
 * when done; never throws. A token that names no waiting invitation keeps nothing.
 */
export async function takeInviteFromAddress(signedOut: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const token = url.searchParams.get(INVITE_PARAM);
  if (token === null) return;
  url.searchParams.delete(INVITE_PARAM);
  try {
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // A sealed history: the token stays in the bar, which only its holder has.
  }
  if (!signedOut || !TOKEN.test(token)) return;
  const result = await accountApi<{ status?: unknown; email?: unknown }>(
    `/invitations/decline/${encodeURIComponent(token)}`,
  );
  if (!result.ok) return;
  const { status, email } = result.data;
  if (
    status === 'invited' &&
    typeof email === 'string' &&
    email.includes('@') &&
    email.length <= ADDRESS_MAX
  ) {
    keep(email);
  }
}
