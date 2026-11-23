'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SubscriptionProviderProps } from '@liveworkspace/subscription-ui/provider';
import type { SettingsRequest } from '../request';

// What the account's own panels (API Tokens, Download Your Data; liveworkspace/docs/specs/010-site/site.md
// "Settings") reach their service with, handed in by whoever opens the Settings panel: the accounts API's account
// routes (the session on liveworkspace.app, the app's bearer door through its router everywhere else). Its own small
// module, so the panels' code stays in their own chunks.

/** How the Subscription category reaches liveworkspace's subscription service (liveworkspace/docs/specs/
 *  019-subscription/subscription.md "A person's browser"): the account's access token, and the service's origin from
 *  an app's page (left out on liveworkspace.app itself), as a string or a function read in the browser. */
export type SubscriptionAccess = Pick<SubscriptionProviderProps, 'getToken' | 'signInHref'> & {
  // Read when the panel is drawn, so a host bound at module scope (an editor's, before there is a window) can work
  // it out from the page's address.
  origin?: string | (() => string);
};

export type AccountPanelsHost = {
  // The accounts API's account routes (`/tokens`, `/teams`, `/data-export`).
  request: SettingsRequest;
  // The subscription service, for the Subscription category. A host without it lists no such category; so does any
  // host in a build with Pro off.
  subscription?: SubscriptionAccess;
};

const AccountPanelsContext = createContext<AccountPanelsHost | null>(null);

export function AccountPanelsProvider({
  host,
  children,
}: {
  host: AccountPanelsHost;
  children: ReactNode;
}) {
  return <AccountPanelsContext value={host}>{children}</AccountPanelsContext>;
}

/** The host the panel was opened with. Drawn only inside an AccountPanelsProvider (accountPanels' cells). */
export function useAccountPanelsHost(): AccountPanelsHost {
  const host = useContext(AccountPanelsContext);
  if (!host)
    throw new Error('An account panel was drawn without its host (AccountPanelsProvider).');
  return host;
}
