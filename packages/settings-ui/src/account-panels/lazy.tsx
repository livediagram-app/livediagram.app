'use client';

import { lazy, Suspense, type ReactNode } from 'react';
import type { AccountSection } from '../account-model';
import { AccountPanelsProvider, type AccountPanelsHost } from './host';

// The account's own panels (liveworkspace/docs/specs/010-site/site.md "Settings": API Tokens and Download Your
// Data), drawn in place wherever a signed-in account opens Settings: liveworkspace.app, an app's Explorer and every
// editor. Each is its own chunk, fetched the first time its category is shown, never with the panel: an editor's
// Settings (and its first load) carries only this module and the host's small context.
const loadTokens = () => import('./tokens/TokensPanel');
const loadDataExport = () => import('./data-export/DataExportPanel');
const loadAi = () => import('./ai/AiKeyPanel');
const AiKeyPanel = lazy(() => loadAi().then((m) => ({ default: m.AiKeyPanel })));
const TokensPanel = lazy(() => loadTokens().then((m) => ({ default: m.TokensPanel })));
const DataExportPanel = lazy(() => loadDataExport().then((m) => ({ default: m.DataExportPanel })));

/** Fetches the panels' code ahead of time (a test warming its imports, say). */
export async function preloadAccountPanels(): Promise<void> {
  await Promise.all([loadTokens(), loadDataExport(), loadAi()]);
}

/** A category drawn from its own chunk, with a quiet placeholder while it loads. `flush`: the panel lays out its own
 *  parts edge to edge in the card, with the hairlines between them (Your Data). */
function AccountPanelCell({
  cell,
  host,
  flush = false,
  children,
}: {
  cell: string;
  host: AccountPanelsHost;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-settings-cell={cell} className={flush ? undefined : 'px-4 py-4'}>
      <Suspense
        fallback={
          <div
            aria-busy
            className="h-40 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        }
      >
        <AccountPanelsProvider host={host}>{children}</AccountPanelsProvider>
      </Suspense>
    </div>
  );
}

/** The Account section's API Tokens and Download Your Data over `host`, for an AccountHost. */
export function accountPanels(
  host: AccountPanelsHost,
): Required<Pick<AccountSection, 'renderAi' | 'renderTokens' | 'renderDataExport'>> &
  Pick<AccountSection, 'subscription'> {
  return {
    // The Subscription category's way to its service (subscription/cells.tsx draws it, with Pro on).
    ...(host.subscription ? { subscription: host.subscription } : {}),
    renderAi: () => (
      <AccountPanelCell cell="ai" host={host}>
        <AiKeyPanel />
      </AccountPanelCell>
    ),
    renderTokens: () => (
      <AccountPanelCell cell="tokens" host={host}>
        <TokensPanel />
      </AccountPanelCell>
    ),
    renderDataExport: () => (
      <AccountPanelCell cell="data" flush host={host}>
        <DataExportPanel />
      </AccountPanelCell>
    ),
  };
}
