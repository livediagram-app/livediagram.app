'use client';

import { useState } from 'react';
import { ErrorNote, Panel } from '../account-ui';
import { ConfirmAction } from '../ConfirmAction';
import { accountErrorMessage as errorMessage, formatAccountDate as formatDate } from '../errors';
import { useAccountPanelsHost } from '../host';
import type { ApiToken } from '../types';

// The account's live API tokens, each with Revoke (Revoke now, Keep), over the panel host's request: Settings › API
// Tokens draws them as cards (TokensPanel), and an OAuth page at the token cap draws them `compact`, as one bordered
// list that scrolls past a few rows (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"). `onRevoked`
// runs once a revoke has gone through, for the caller to read the list again and say what changed.
export function TokenList({
  tokens,
  onRevoked,
  compact = false,
}: {
  tokens: ApiToken[];
  onRevoked: (token: ApiToken) => Promise<void> | void;
  compact?: boolean;
}) {
  return (
    <ul
      className={
        compact
          ? 'max-h-72 divide-y divide-slate-200 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700'
          : 'mt-4 space-y-3'
      }
    >
      {tokens.map((token) => (
        <TokenRow key={token.id} token={token} onRevoked={onRevoked} compact={compact} />
      ))}
    </ul>
  );
}

function TokenRow({
  token,
  onRevoked,
  compact,
}: {
  token: ApiToken;
  onRevoked: (token: ApiToken) => Promise<void> | void;
  compact: boolean;
}) {
  const { request } = useAccountPanelsHost();
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    const result = await request(`/tokens/${token.id}`, 'DELETE');
    if (result.ok) await onRevoked(token);
    else setError(result.error);
  }

  const used = token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : 'Not used yet';
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`flex min-w-0 items-center gap-2 font-semibold text-slate-900 dark:text-white ${compact ? 'text-sm' : ''}`}
          >
            <bdi className="truncate">{token.name}</bdi>
            {token.readOnly && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Read only
              </span>
            )}
          </p>
          <p
            className={
              compact
                ? 'text-xs text-slate-500 dark:text-slate-400'
                : 'text-sm text-slate-600 dark:text-slate-400'
            }
          >
            {compact
              ? token.lastUsedAt
                ? used
                : `${used} · Made ${formatDate(token.createdAt)}`
              : `Made ${formatDate(token.createdAt)} · ${used} · Expires ${formatDate(token.expiresAt)}`}
          </p>
        </div>
        <ConfirmAction label="Revoke" confirmLabel="Revoke now" onConfirm={revoke} />
      </div>
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </>
  );

  return (
    <li className={compact ? 'px-3 py-2.5' : undefined}>
      {compact ? body : <Panel>{body}</Panel>}
    </li>
  );
}
