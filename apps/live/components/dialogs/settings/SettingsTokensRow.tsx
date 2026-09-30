'use client';

import { useState } from 'react';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useTokens } from '@/hooks/persistence/useTokens';
import { CATEGORY_GLYPHS } from './settings-icons';
import { SettingsRowShell } from './SettingsRowShell';
import { SettingsSignInLink } from './SettingsSignInLink';
import { SettingsTokenCreate } from './SettingsTokenCreate';
import { SettingsTokenList } from './SettingsTokenList';
import { SettingsTokenOverview } from './SettingsTokenOverview';
import { SettingsTokenReveal } from './SettingsTokenReveal';
import type { SettingsTokensRowSpec } from './settings-catalogue';

// The API Tokens category's one row: the whole token manager
// (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// Overview and capacity, then whichever of the composer or the one-time
// reveal is open, then the tokens. Tokens are Clerk-only, so a guest gets the
// reason and a way to sign in rather than a form that would only ever 403.
export function SettingsTokensRow({ row }: { row: SettingsTokensRowSpec }) {
  const { authLoaded, clerkUserId, isSignedIn } = useClerkApiBootstrap();
  const enabled = Boolean(isSignedIn && clerkUserId);
  const tokens = useTokens(clerkUserId ?? null, { enabled });
  const [composing, setComposing] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const busy = composing || secret !== null;

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
          {!authLoaded ? null : !enabled ? (
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
              >
                {CATEGORY_GLYPHS.tokens}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {row.label}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Sign in to create API tokens.
                  <SettingsSignInLink />
                </span>
              </span>
            </div>
          ) : (
            <>
              <SettingsTokenOverview
                count={tokens.list === null ? null : tokens.count}
                max={tokens.max}
                composing={busy}
                onNew={() => setComposing(true)}
              />
              {secret !== null ? (
                <SettingsTokenReveal secret={secret} onDone={() => setSecret(null)} />
              ) : composing ? (
                <SettingsTokenCreate
                  tokens={tokens}
                  onCancel={() => setComposing(false)}
                  onCreated={(minted) => {
                    setComposing(false);
                    setSecret(minted);
                  }}
                />
              ) : null}
              <SettingsTokenList
                tokens={tokens.list}
                onRevoke={tokens.revoke}
                onCreateFirst={busy ? undefined : () => setComposing(true)}
              />
            </>
          )}
        </div>
      )}
    />
  );
}
