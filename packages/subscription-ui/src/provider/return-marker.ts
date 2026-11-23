// Coming back from the checkout or the billing portal (subscription.md "Billing"). Both are other pages, so the app
// is left and loaded again: the address it comes back to carries `?subscribed=1` after a checkout, and this browser
// remembers whose subscription it left for, so the page can say what changed once the service confirms it.
import { isOwnerScope, type OwnerScope } from '@liveworkspace/subscription';

export const SUBSCRIBED_PARAM = 'subscribed';
const LEAVING_KEY = 'liveworkspace:subscription:leaving';

export type Leaving = { owner: OwnerScope; kind: 'checkout' | 'portal' };

export function markLeaving(leaving: Leaving): void {
  try {
    sessionStorage.setItem(LEAVING_KEY, JSON.stringify(leaving));
  } catch {
    // No storage (a private window that refuses it): the page still refetches when it loads again.
  }
}

/** Whose subscription this browser left for, without forgetting it. */
export function readLeaving(): Leaving | null {
  try {
    const raw = sessionStorage.getItem(LEAVING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { owner, kind } = parsed as { owner?: unknown; kind?: unknown };
    if (!isOwnerScope(owner) || (kind !== 'checkout' && kind !== 'portal')) return null;
    return { owner, kind };
  } catch {
    return null;
  }
}

export function clearLeaving(): void {
  try {
    sessionStorage.removeItem(LEAVING_KEY);
  } catch {
    // Nothing was kept.
  }
}

/** The address to come back to: `base` (this page when not given), marked as a return from a checkout. */
export function returnAddress(base: string, subscribed: boolean): string {
  const url = new URL(base, window.location.href);
  if (subscribed) url.searchParams.set(SUBSCRIBED_PARAM, '1');
  else url.searchParams.delete(SUBSCRIBED_PARAM);
  return url.href;
}

/** Whether this page was opened by a return from a checkout. */
export function arrivedSubscribed(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(SUBSCRIBED_PARAM);
}

/** Takes the return marker off the address bar, so a reload or a shared link does not carry it. */
export function stripSubscribedParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SUBSCRIBED_PARAM)) return;
  url.searchParams.delete(SUBSCRIBED_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
