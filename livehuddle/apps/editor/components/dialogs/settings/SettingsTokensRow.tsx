'use client';

import { ButtonContent, buttonClassName } from '@livehuddle/ui';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { manageTokensUrl } from '@liveworkspace/workbench/lib/auth-config';
import { SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import { SettingsRowShell } from '@liveworkspace/settings-ui';
import { SettingsSignInLink } from '@liveworkspace/workbench/components/dialogs/settings/SettingsSignInLink';
import type { SettingsTokensRowSpec } from './settings-catalogue';

// The API Tokens category's one row (docs/specs/015-api/public-api-and-tokens.md#36-management-the-settings-dialogs-api-tokens-category).
// API tokens are the liveworkspace account's (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): one token
// works on every app's API, and they are made, listed and revoked on liveworkspace.app, so this row
// says so and links there. Tokens are signed-in only, so a guest gets the reason and a way to sign in.
export function SettingsTokensRow({ row }: { row: SettingsTokensRowSpec }) {
  const { authLoaded, accountUserId, isSignedIn } = useAccountBootstrap();
  const enabled = Boolean(isSignedIn && accountUserId);

  return (
    <SettingsRowShell
      row={row}
      leading={
        // The key tile heads the row: muted until signed in.
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            authLoaded && !enabled
              ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400'
              : 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm shadow-slate-900/20 dark:from-slate-500 dark:to-slate-700'
          }`}
        >
          <SettingsSharedGlyph id="tokens" />
        </span>
      }
      descriptionContent={
        authLoaded && !enabled ? (
          <>
            Sign in to create API tokens.
            <SettingsSignInLink />
          </>
        ) : undefined
      }
    >
      {!authLoaded || !enabled ? null : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your API tokens belong to your liveworkspace account, so one token works in every
            liveworkspace app. Make, see and revoke them on liveworkspace.app.
          </p>
          <a
            href={manageTokensUrl}
            className={buttonClassName({ size: 'sm', className: 'w-fit shadow-sm' })}
          >
            <ButtonContent>Manage API Tokens</ButtonContent>
          </a>
        </div>
      )}
    </SettingsRowShell>
  );
}
