// The subscription service as a page calls it (subscription.md "The subscription Worker"): the signed-in person's own
// subscription, the prices in their currency, and the way into checkout and the billing portal. A page built with
// Pro off never makes one of these.

import type { OwnerScope } from './owner';
import type { LimitKey } from './tiers';
import {
  SUBSCRIPTION_API_PATH,
  type MeResponse,
  type MockCheckout,
  type MockCheckoutAction,
  type MockPortal,
  type MockPortalRequest,
  type OwnerView,
  type PricesResponse,
  type RedirectResponse,
  type TeamRequestResponse,
} from './wire';

export type SubscriptionBrowserConfig = {
  /** The service's origin, without a trailing slash. Empty for a page on liveworkspace.app itself. */
  origin?: string;
  /** The account's access token, or null when nobody is signed in. */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
};

/** A refusal from the service, with the `{ error }` it answered. */
export class SubscriptionRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`Subscription request failed: ${status} ${code}`);
    this.name = 'SubscriptionRequestError';
    this.status = status;
    this.code = code;
  }
}

export type SubscriptionBrowserClient = {
  /** Public: what each paid tier costs in the visitor's currency. */
  prices: () => Promise<PricesResponse>;
  /** The signed-in person's subscription, usage and teams, or null when signed out. */
  me: () => Promise<MeResponse | null>;
  /** What this person may know of an item's owner, or null when signed out. */
  ownerView: (owner: OwnerScope) => Promise<OwnerView | null>;
  checkout: (owner: OwnerScope, returnTo: string) => Promise<RedirectResponse>;
  portal: (owner: OwnerScope, returnTo: string) => Promise<RedirectResponse>;
  /** Asks a team's admins for Pro for Teams, as one of its members, with the limit that prompted it and a note.
   *  `sent` false: already asked today. */
  askTeam: (
    owner: OwnerScope,
    limit?: LimitKey | null,
    note?: string | null,
  ) => Promise<TeamRequestResponse>;
  /** Says "You're Back on Free" has been read for `owner`, so no browser says it again. */
  dismissEnded: (owner: OwnerScope) => Promise<void>;
  mockCheckout: (id: string) => Promise<MockCheckout>;
  actOnMockCheckout: (id: string, action: MockCheckoutAction) => Promise<RedirectResponse>;
  mockPortal: (id: string) => Promise<MockPortal>;
  actOnMockPortal: (id: string, request: MockPortalRequest) => Promise<MockPortal>;
};

function errorCode(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  )
    return body.error;
  return 'unknown';
}

export function createSubscriptionBrowserClient(
  config: SubscriptionBrowserConfig,
): SubscriptionBrowserClient {
  const base = `${(config.origin ?? '').replace(/\/+$/, '')}${SUBSCRIPTION_API_PATH}`;
  const doFetch = config.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(
    path: string,
    options: { token?: string | null; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await doFetch(`${base}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new SubscriptionRequestError(response.status, errorCode(body));
    return body as T;
  }

  /** A signed-in read: null when nobody is signed in, without asking the service. */
  async function signedIn<T>(path: string): Promise<T | null> {
    const token = await config.getToken();
    return token ? request<T>(path, { token }) : null;
  }

  /** A signed-in write: refused here when nobody is signed in. */
  async function write<T>(path: string, body: unknown): Promise<T> {
    const token = await config.getToken();
    if (!token) throw new SubscriptionRequestError(401, 'unauthorised');
    return request<T>(path, { token, body });
  }

  const mock = (kind: 'checkout' | 'portal', id: string) =>
    `/mock/${kind}/${encodeURIComponent(id)}`;

  return {
    prices: () => request<PricesResponse>('/prices'),
    me: () => signedIn<MeResponse>('/me'),
    ownerView: (owner) => signedIn<OwnerView>(`/owner?scope=${encodeURIComponent(owner)}`),
    checkout: (owner, returnTo) => write<RedirectResponse>('/checkout', { owner, returnTo }),
    portal: (owner, returnTo) => write<RedirectResponse>('/portal', { owner, returnTo }),
    askTeam: (owner, limit, note) =>
      write<TeamRequestResponse>('/team-request', {
        owner,
        limit: limit ?? null,
        note: note ?? null,
      }),
    dismissEnded: async (owner) => {
      await write<unknown>('/ended/dismiss', { owner });
    },
    mockCheckout: (id) => request<MockCheckout>(mock('checkout', id)),
    actOnMockCheckout: (id, action) =>
      request<RedirectResponse>(mock('checkout', id), { body: { action } }),
    mockPortal: (id) => request<MockPortal>(mock('portal', id)),
    actOnMockPortal: (id, body) => request<MockPortal>(mock('portal', id), { body }),
  };
}
