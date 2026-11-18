'use client';

// Delete Account from the Explorer's Settings on an app's own address (liveworkspace/docs/specs/010-site/site.md
// "Settings", "Your Account"; Work Tracker 1228): the app's own dialog, the one its editor opens
// (@liveworkspace/workbench DeleteAccountDialog), unchanged. The typed email, then the code emailed to the account, both
// asked of the app's own api on this address with the app's token: it checks the code, deletes the app's data and
// closes the account. Then the app's session ends and the page goes to the app's landing page as a fresh guest.

import { useMemo } from 'react';
import { DeleteAccountDialog } from '@liveworkspace/workbench/components/dialogs/DeleteAccountDialog';
import {
  DEFERRED_AUTH_DEFAULT,
  DeferredAuthContext,
  type DeferredAuthState,
} from '@liveworkspace/workbench/components/providers/deferred-auth';
import {
  accountDeletionOf,
  deletionCodeSentOf,
  type AccountDeletion,
  type DeletionCodeSent,
} from '@liveworkspace/workbench/lib/account-deletion';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { appAccount, appSignOut } from '@/lib/explorer/app-session';
import { trackAppEvent } from '@/lib/explorer/telemetry';

/** The app's own `POST /api/account/deletion-code`, with the app's token. */
export async function sendAppDeletionCode(): Promise<DeletionCodeSent> {
  const account = await appAccount();
  if (!account) return 'failed';
  const res = await fetch('/api/account/deletion-code', {
    method: 'POST',
    headers: { authorization: `Bearer ${account.token}` },
  });
  return deletionCodeSentOf(res);
}

/** The app's own `DELETE /api/account { code }`, with the app's token. */
export async function deleteAppAccount(code: string): Promise<AccountDeletion> {
  const account = await appAccount();
  if (!account) return 'failed';
  const res = await fetch('/api/account', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return accountDeletionOf(res);
}

/** Ends the app's session once its data is gone, staying on the page; the dialog says "Sign out to finish" on a
 *  refusal. */
export async function endAppSession(): Promise<void> {
  const left = await appSignOut(() => {});
  if (!left) throw new Error('the app did not sign out');
}

export default function AppDeleteAccountDialog({
  app,
  account,
  onClose,
}: {
  app: AppName;
  // The app account: its address is what the dialog asks for typed, as the editor's does.
  account: { id: string; email: string | null };
  onClose: () => void;
}) {
  // The person, as the editor's auth bridge would publish them: all the dialog reads is the address and the way to end
  // the session.
  const auth = useMemo<DeferredAuthState>(
    () => ({
      ...DEFERRED_AUTH_DEFAULT,
      authLoaded: true,
      isSignedIn: true,
      userId: account.id,
      user: {
        id: account.id,
        firstName: null,
        lastName: null,
        fullName: null,
        username: null,
        email: account.email,
        createdAt: null,
      },
      deleteAccount: endAppSession,
    }),
    [account.id, account.email],
  );
  return (
    <DeferredAuthContext.Provider value={auth}>
      <DeleteAccountDialog
        open
        onClose={onClose}
        onDeleted={() => window.location.assign('/')}
        appName={app}
        localItems={APP_ITEMS[app].nouns}
        sendCode={sendAppDeletionCode}
        deleteAccount={deleteAppAccount}
        // The account-lifecycle counter, in the app's name, as its editor counts it.
        onDataDeleted={() => trackAppEvent('Session', 'Deleted', 'Account')}
      />
    </DeferredAuthContext.Provider>
  );
}
