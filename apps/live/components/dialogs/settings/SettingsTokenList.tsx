'use client';

// The token manager's list (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// newest first, one card each, and a revoke that confirms in a popover
// before anything breaks.
import { useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { useRelativeNow } from '@/lib/relative-time';
import { SettingsTokenCard } from './SettingsTokenCard';
import { TOKEN_REVOKE_MESSAGE } from './token-copy';
import { sortTokens } from './token-status';

export function SettingsTokenList({
  tokens,
  onRevoke,
}: {
  tokens: ApiToken[] | null;
  onRevoke: (id: string) => void;
}) {
  const now = useRelativeNow();
  const [confirm, setConfirm] = useState<{ id: string; anchor: HTMLElement } | null>(null);

  if (tokens === null) {
    return (
      <ul aria-busy className="flex flex-col gap-2.5" aria-label="Loading tokens">
        {[0, 1].map((i) => (
          <li
            key={i}
            className="h-[5.5rem] rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
          />
        ))}
      </ul>
    );
  }

  // With none, the composer above IS the empty state (SettingsTokensRow).
  if (tokens.length === 0) return null;

  return (
    <>
      <ul className="flex flex-col gap-2.5" aria-label="Your API tokens">
        {sortTokens(tokens).map((token) => (
          <SettingsTokenCard
            key={token.id}
            token={token}
            now={now}
            onRevoke={(anchor) => setConfirm({ id: token.id, anchor })}
          />
        ))}
      </ul>
      {confirm ? (
        <ConfirmPopover
          anchor={confirm.anchor}
          message={TOKEN_REVOKE_MESSAGE}
          confirmLabel="Revoke"
          onConfirm={() => {
            onRevoke(confirm.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}
