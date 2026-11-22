'use client';

// The account's live API tokens on an OAuth page at the token cap (docs/specs/015-api/mcp-server.md "Consent + mint"),
// shared by the consent and device pages: the person frees one here and connects straight after, rather than going
// to Settings and starting the connection again. Least recently used first, since those are the ones to let go; the
// rows are Settings' own (@liveworkspace/settings-ui's TokenList, compact), over the same bearer door.
import { useMemo } from 'react';
import { Callout } from '@liveworkspace/ui/callout';
import {
  AccountPanelsProvider,
  TokenList,
  accountErrorMessage,
  useAccountData,
  type AccountPanelsHost,
  type ApiToken,
} from '@liveworkspace/settings-ui/token-list';
import { accountTokensRequest, leastRecentlyUsedFirst } from '../../lib/oauth-replaced-tokens';

export function TokenLimitList({ onFreed }: { onFreed: () => void }) {
  // One host for the page's life, so the list's read isn't redone on every render.
  const host = useMemo<AccountPanelsHost>(() => ({ request: accountTokensRequest() }), []);
  return (
    <AccountPanelsProvider host={host}>
      <Tokens onFreed={onFreed} />
    </AccountPanelsProvider>
  );
}

function Tokens({ onFreed }: { onFreed: () => void }) {
  const [load, refresh] = useAccountData<{ tokens: ApiToken[] }>('/tokens');
  const tokens = useMemo(
    () => (load.state === 'ready' ? leastRecentlyUsedFirst(load.data.tokens) : []),
    [load],
  );

  return (
    <section aria-labelledby="oauth-live-tokens" className="mt-3">
      <h2 id="oauth-live-tokens" className="text-sm font-semibold text-slate-900 dark:text-white">
        Your API Tokens
      </h2>
      <p className="mt-0.5 mb-2 text-xs text-slate-500 dark:text-slate-400">
        Least recently used first. Revoking one disconnects whatever uses it.
      </p>
      {load.state === 'loading' && (
        <div
          role="status"
          aria-busy
          aria-label="Loading your tokens"
          className="h-28 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      )}
      {load.state === 'error' && (
        <Callout
          tone="error"
          role="alert"
          action={{ label: 'Try Again', onSelect: () => void refresh() }}
        >
          {accountErrorMessage(load.error)}
        </Callout>
      )}
      {load.state === 'ready' && tokens.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          None are live just now, so there’s room: choose Connect.
        </p>
      )}
      {load.state === 'ready' && tokens.length > 0 && (
        <TokenList
          compact
          tokens={tokens}
          onRevoked={async () => {
            await refresh();
            onFreed();
          }}
        />
      )}
    </section>
  );
}
