'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SettingsRequest } from '../request';

// What the account's own panels (API Tokens, Download Your Data; liveworkspace/docs/specs/010-site/site.md
// "Settings") reach their service with, handed in by whoever opens the Settings panel: the accounts API's account
// routes (the session on liveworkspace.app, the app's bearer door through its router everywhere else). Its own small
// module, so the panels' code stays in their own chunks.

export type AccountPanelsHost = {
  // The accounts API's account routes (`/tokens`, `/teams`, `/data-export`).
  request: SettingsRequest;
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
