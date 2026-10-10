'use client';

// "Switch Google Account?" (docs/specs/022-drive-mirror/drive-mirror.md,
// "Reconnecting with another Google account"; blueprint "Account switch
// dialog"). Shown on /drive/connected when the consent came from another
// Google account than the one Cloud Sync uses: nothing has changed yet, and
// the owner confirms or cancels the switch here. An account-level setting:
// no shared document reaches it.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { ApiError } from '@/lib/api/core';

export const ACCOUNT_SWITCH_TITLE = 'Switch Google Account?';
export const ACCOUNT_SWITCH_BODY =
  'This Google account is not the one livediagram syncs with. Switching moves Cloud Sync to the new account and starts a fresh copy of My documents in its Drive. The files already in the other account’s Drive stay there untouched.';
export const ACCOUNT_SWITCH_EXPIRED =
  'This request timed out. Nothing changed. Connect again from Settings, Account, Cloud Sync.';
export const ACCOUNT_SWITCH_FAILED = 'That didn’t work. Nothing changed. Try again.';

type Phase = 'ask' | 'switching' | 'keeping' | 'failed' | 'expired';

export type DriveAccountSwitchDialogProps = {
  // Each resolves once the api accepted it and the page is leaving; a throw
  // keeps the dialog open with the error.
  onSwitch: () => Promise<void>;
  onKeep: () => Promise<void>;
  // Where Back to Cloud Sync goes once the switch expired.
  cloudSyncHref: string;
};

export function DriveAccountSwitchDialog({
  onSwitch,
  onKeep,
  cloudSyncHref,
}: DriveAccountSwitchDialogProps) {
  const [phase, setPhase] = useState<Phase>('ask');
  const switchRef = useRef<HTMLButtonElement>(null);
  const busy = phase === 'switching' || phase === 'keeping';

  useEffect(() => {
    switchRef.current?.focus();
  }, []);

  const run = async (next: 'switching' | 'keeping', action: () => Promise<void>) => {
    setPhase(next);
    try {
      await action();
    } catch (err) {
      setPhase(
        err instanceof ApiError && err.code === 'drive_account_switch_expired'
          ? 'expired'
          : 'failed',
      );
    }
  };
  const keep = () => {
    if (!busy && phase !== 'expired') void run('keeping', onKeep);
  };

  return (
    <Dialog open onClose={keep} titleId="drive-account-switch-title" closeOnEscape={!busy}>
      <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <h2
          id="drive-account-switch-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          {ACCOUNT_SWITCH_TITLE}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {phase === 'expired' ? ACCOUNT_SWITCH_EXPIRED : ACCOUNT_SWITCH_BODY}
        </p>
        {phase === 'failed' && (
          <p role="alert" className="mt-2 text-sm text-slate-900 dark:text-slate-50">
            {ACCOUNT_SWITCH_FAILED}
          </p>
        )}
      </div>
      <DialogFooter>
        {phase === 'expired' ? (
          <Button variant="primary" onClick={() => window.location.assign(cloudSyncHref)}>
            Back to Cloud Sync
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={keep}>
              Keep Current Account
            </Button>
            <Button
              ref={switchRef}
              variant="primary"
              disabled={busy}
              onClick={() => void run('switching', onSwitch)}
            >
              {phase === 'switching' ? 'Switching…' : 'Switch Account'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
