'use client';

// Delete Account (docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"): every editor's dialog
// (@liveworkspace/workbench), bound to livedocuments's name, api and telemetry. The typed email, then the code emailed to the
// account, which the api checks before anything is deleted.

import { DeleteAccountDialog as SharedDeleteAccountDialog } from '@liveworkspace/workbench/components/dialogs/DeleteAccountDialog';
import { apiDeleteAccount, apiSendDeletionCode } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// The account-lifecycle counter for the dashboard's Account Activity stack (docs/specs/017-telemetry/telemetry.md):
// anonymous, fired once the server data is gone but before sign-out, so the opt-out itself still reaches the wire.
const trackDeleted = () => track('Session', 'Deleted', 'Account');

export function DeleteAccountDialog(props: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}) {
  return (
    <SharedDeleteAccountDialog
      {...props}
      appName="livedocuments"
      localItems="Documents"
      sendCode={apiSendDeletionCode}
      deleteAccount={apiDeleteAccount}
      onDataDeleted={trackDeleted}
    />
  );
}
