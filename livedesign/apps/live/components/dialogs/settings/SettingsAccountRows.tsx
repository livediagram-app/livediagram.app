'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@livedesign/ui';
import { ProfileHeaderCard, SettingsRowShell } from '@liveworkspace/settings-ui';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { SettingsSignInLink } from './SettingsSignInLink';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import type { SettingsDeleteAccountRowSpec, SettingsIdentityRowSpec } from './settings-catalogue';

// The account rows, moved here from the Explorer's /explorer/profile page
// (docs/specs/014-identity/profile-and-email-notifications.md) when that page was retired: everything it held now lives in
// Settings, so a second account home was a second place to look.
//
// Lazy: almost nobody deletes, so it only loads on first click.
const DeleteAccountDialog = dynamic(
  () => import('@/components/dialogs/DeleteAccountDialog').then((m) => m.DeleteAccountDialog),
  { ssr: false },
);

// Identity, read from the account. Never written here: names and emails are managed
// on the liveworkspace accounts site, so this is a card, not a form. The card is the shared Profile's header
// (@liveworkspace/settings-ui ProfileHeaderCard; liveworkspace/docs/site.md "Settings", "Profile"): the avatar,
// name, email and when they joined; a guest gets the guest card and the way in.
export function SettingsIdentityRow({ row }: { row: SettingsIdentityRowSpec }) {
  const { authLoaded, isSignedIn, user } = useDeferredAuth();
  const { signInHref, signUpHref } = useAuthHrefs();
  const signedIn = Boolean(authLoaded && isSignedIn && user);
  return (
    <div data-settings-cell={row.key} className="rounded-[inherit]">
      {signedIn && user ? (
        <ProfileHeaderCard
          identity={{
            name: user.fullName ?? user.username ?? user.email ?? 'Your account',
            email: user.email,
            joined: user.createdAt,
          }}
        />
      ) : (
        <ProfileHeaderCard guest={{ signInHref, signUpHref, things: 'designs' }} />
      )}
    </div>
  );
}

// Delete account. Signed-in only, and not because of the UI: the api's
// DELETE /api/account is signed-in only by design (docs/specs/014-identity/profile-and-email-notifications.md), since the whole
// point is wiping data bound to a VERIFIED identity. A guest's owner id is an
// unverified header, so honouring it would let anyone wipe anyone's designs.
// The row still renders for guests, saying why, rather than vanishing, so the
// answer to "can I delete my data?" is in the panel either way.
export const DELETE_ACCOUNT_SIGNED_IN =
  'Permanently removes your livedesign designs (the Trash included), folders and settings, closes your liveworkspace account for every app, then signs you out. There is no undo: you type your email to confirm.';
export const DELETE_ACCOUNT_GUEST =
  'Available once you sign in: a guest browser has no verified account to delete.';

export function SettingsDeleteAccountRow({ row }: { row: SettingsDeleteAccountRowSpec }) {
  const { authLoaded, isSignedIn, user, signOut } = useDeferredAuth();
  const signedIn = Boolean(authLoaded && isSignedIn && user);
  const [open, setOpen] = useState(false);

  // One row, the button beside the label and what it does under it.
  const described = {
    ...row,
    description: signedIn ? DELETE_ACCOUNT_SIGNED_IN : DELETE_ACCOUNT_GUEST,
  };

  return (
    <SettingsRowShell
      row={described}
      control={
        signedIn ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="shrink-0">
            Delete Account
          </Button>
        ) : (
          // A guest is offered the way in, beside the label.
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
            <SettingsSignInLink />
          </span>
        )
      }
    >
      {open ? (
        <DeleteAccountDialog
          open={open}
          onClose={() => setOpen(false)}
          onDeleted={async () => {
            // The data delete already completed inside the dialog;
            // sign out to clear client state and land on marketing.
            await signOut({ redirectUrl: '/' });
          }}
        />
      ) : null}
    </SettingsRowShell>
  );
}
