'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button, SOLID_BRAND_DARK, PictureDisc } from '@livediagram/ui';
import { SettingsRowShell } from './SettingsRowShell';
import { SettingsSignInLink } from './SettingsSignInLink';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { accountInitial } from '@/lib/account-avatar';
import type { SettingsDeleteAccountRowSpec, SettingsIdentityRowSpec } from './settings-catalogue';

// The account rows, moved here from the Explorer's /explorer/profile page
// (docs/specs/014-identity/profile-and-email-notifications.md) when that page was retired: everything it held now lives in
// Settings, so a second account home was a second place to look.
//
// Lazy: the confirmation modal pulls in Clerk's reverification surface and
// almost nobody deletes, so it only loads on first click.
const DeleteAccountDialog = dynamic(
  () => import('@/components/dialogs/DeleteAccountDialog').then((m) => m.DeleteAccountDialog),
  { ssr: false },
);

// The identity card's avatar diameter.
const IDENTITY_AVATAR_PX = 44;

// Identity, read from Clerk. Never written here: names and emails are managed
// in Clerk itself, so this is a card, not a form.
export function SettingsIdentityRow({ row }: { row: SettingsIdentityRowSpec }) {
  const { authLoaded, isSignedIn, user } = useDeferredAuth();
  const signedIn = Boolean(authLoaded && isSignedIn && user);
  const name = user?.fullName ?? user?.username ?? user?.email ?? 'Your account';
  const joined = user?.createdAt
    ? user.createdAt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          {signedIn ? (
            <>
              <PictureDisc
                pictureUrl={user?.pictureUrl}
                size={IDENTITY_AVATAR_PX}
                aria-hidden
                className={`bg-brand-500 text-lg font-semibold text-white ${SOLID_BRAND_DARK}`}
              >
                {accountInitial(user)}
              </PictureDisc>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {name}
                </span>
                {user?.email ? (
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </span>
                ) : null}
                {joined ? (
                  <span className="mt-0.5 block text-[11px] text-slate-400">Joined {joined}</span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                {row.label}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                You are working as a guest. Sign in to keep your documents across devices.
                <SettingsSignInLink />
              </span>
            </span>
          )}
        </div>
      )}
    />
  );
}

// Delete account. Signed-in only, and not because of the UI: the api's
// DELETE /api/account is Clerk-only by design (docs/specs/014-identity/profile-and-email-notifications.md), since the whole
// point is wiping data bound to a VERIFIED identity. A guest's owner id is an
// unverified header, so honouring it would let anyone wipe anyone's documents.
// The row still renders for guests, saying why, rather than vanishing, so the
// answer to "can I delete my data?" is in the panel either way.
export const DELETE_ACCOUNT_SIGNED_IN =
  'Permanently removes your documents (the Trash included), folders and account, everywhere. There is no undo: you type your email to confirm.';
export const DELETE_ACCOUNT_GUEST =
  'Only available once you are signed in: a guest browser has no verified account to delete.';

export function SettingsDeleteAccountRow({ row }: { row: SettingsDeleteAccountRowSpec }) {
  const { authLoaded, isSignedIn, user, signOut } = useDeferredAuth();
  const signedIn = Boolean(authLoaded && isSignedIn && user);
  const [open, setOpen] = useState(false);

  // One row, the button beside the label; what it does is said below the card.
  const described = {
    ...row,
    description: signedIn ? DELETE_ACCOUNT_SIGNED_IN : DELETE_ACCOUNT_GUEST,
  };

  return (
    <SettingsRowShell
      row={described}
      wrapper={() => (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-slate-700">
          <span className="min-w-0 text-sm font-medium text-slate-900 dark:text-slate-100">
            {row.label}
          </span>
          {signedIn ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(true)}
              className="shrink-0"
            >
              Delete Account
            </Button>
          ) : (
            // A guest is offered the way in, beside the label.
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              <SettingsSignInLink />
            </span>
          )}
          {open ? (
            <DeleteAccountDialog
              open={open}
              onClose={() => setOpen(false)}
              onDeleted={async () => {
                // Backend + Clerk delete already completed inside the dialog;
                // sign out to clear client state and land on marketing.
                await signOut({ redirectUrl: '/' });
              }}
            />
          ) : null}
        </div>
      )}
    />
  );
}
