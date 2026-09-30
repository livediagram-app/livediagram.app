'use client';

import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useTokens } from '@/hooks/persistence/useTokens';
import { SettingsRowShell } from './SettingsRowShell';
import { SettingsSignInLink } from './SettingsSignInLink';
import { SettingsTokenCreate } from './SettingsTokenCreate';
import { SettingsTokenList } from './SettingsTokenList';
import type { SettingsTokensRowSpec } from './settings-catalogue';

// The API Tokens category's one row: the whole token manager
// (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// Create (with the one-time secret reveal), the list, and revoke per token.
// Tokens are Clerk-only, so a guest gets the reason and a way to sign in
// rather than a form that would only ever 403.
export function SettingsTokensRow({ row }: { row: SettingsTokensRowSpec }) {
  const { authLoaded, clerkUserId, isSignedIn } = useClerkApiBootstrap();
  const enabled = Boolean(isSignedIn && clerkUserId);
  const tokens = useTokens(clerkUserId ?? null, { enabled });

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.label}
          </span>
          {!authLoaded ? null : !enabled ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in to create API tokens.
              <SettingsSignInLink />
            </p>
          ) : (
            <>
              <SettingsTokenCreate tokens={tokens} />
              <SettingsTokenList tokens={tokens.list} onRevoke={tokens.revoke} />
            </>
          )}
        </div>
      )}
    />
  );
}
