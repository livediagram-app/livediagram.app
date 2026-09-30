'use client';

// The token manager's list (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// newest first, one card each, and a revoke that confirms in a popover
// before anything breaks. With none yet, an empty state that shows what a
// token is FOR (a command using one) rather than just saying there are none.
import { useState } from 'react';
import type { ApiToken } from '@livediagram/api-schema';
import { Button } from '@livediagram/ui';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useRelativeNow } from '@/lib/relative-time';
import { SettingsTokenCard } from './SettingsTokenCard';
import { TOKEN_REVOKE_MESSAGE } from './token-copy';
import { sortTokens } from './token-status';

export function SettingsTokenList({
  tokens,
  onRevoke,
  onCreateFirst,
}: {
  tokens: ApiToken[] | null;
  onRevoke: (id: string) => void;
  // Absent while the composer or a reveal is already showing.
  onCreateFirst?: () => void;
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

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center dark:border-slate-700">
        <pre
          aria-hidden
          className="w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-[10px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
        >
          <span className="text-slate-400 dark:text-slate-600">$ </span>curl …/api/documents \{'\n'}
          {'  '}-H &quot;Authorization: Bearer{' '}
          <span className="text-emerald-600 dark:text-emerald-400">lvd_</span>
          <span className="text-slate-400 dark:text-slate-600">••••••</span>&quot;
        </pre>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No Tokens Yet</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Create one to let a script or an AI tool work with your documents.
          </p>
        </div>
        {onCreateFirst ? (
          <Button size="xs" onClick={onCreateFirst}>
            Create Your First Token
          </Button>
        ) : null}
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Connecting Claude or another AI tool?{' '}
          <HelpArticleLink article="connectAiTool" variant="text" label="Read the guide" />
        </p>
      </div>
    );
  }

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
