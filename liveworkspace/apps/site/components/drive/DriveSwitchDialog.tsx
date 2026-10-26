'use client';

// Switch Google Account? (liveworkspace/docs/specs/005-drive/drive.md "Connecting", "Reconnecting with another Google account"): shown on /drive/connected when the consent came from another Google
// account than the one Cloud Sync uses. Nothing has changed yet; the person confirms or cancels here. A pending switch
// lasts 30 minutes; answered after that, the dialog says so and offers the way back.
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogFooter } from '@liveworkspace/ui';
import type { DriveClient } from '@liveworkspace/drive/client';
import { switchOutcome } from '@/lib/drive/pages';
import { BUTTON } from '../settings/account-ui';

export const ACCOUNT_SWITCH_TITLE = 'Switch Google Account?';
export const ACCOUNT_SWITCH_BODY =
  'This Google account is not the one liveworkspace syncs with. Switching moves Cloud Sync to the new account and starts a fresh copy of your work in its Drive. The files already in the other account’s Drive stay there untouched.';
export const ACCOUNT_SWITCH_EXPIRED =
  'This request timed out. Nothing changed. Connect again from Settings, Account, Cloud Sync.';
export const ACCOUNT_SWITCH_FAILED = 'That didn’t work. Nothing changed. Try again.';

type Phase = 'ask' | 'switching' | 'keeping' | 'failed' | 'expired';

export function DriveSwitchDialog({
  client,
  onSwitched,
  onKept,
  cloudSyncHref,
}: {
  client: Pick<DriveClient, 'confirmSwitch' | 'cancelSwitch'>;
  // Each called once the service took the answer; the page leaves.
  onSwitched: () => void;
  onKept: () => void;
  // Where Back to Cloud Sync goes once the switch expired.
  cloudSyncHref: string;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const switchRef = useRef<HTMLButtonElement>(null);
  const busy = phase === 'switching' || phase === 'keeping';

  useEffect(() => {
    switchRef.current?.focus();
  }, []);

  const answer = async (next: 'switching' | 'keeping') => {
    setPhase(next);
    const result = await (next === 'switching' ? client.confirmSwitch() : client.cancelSwitch());
    const outcome = switchOutcome(result);
    if (outcome === 'done') {
      if (next === 'switching') onSwitched();
      else onKept();
      return;
    }
    // Keep Current Account on a switch already gone: nothing is pending, which is what keeping asked for.
    if (outcome === 'expired' && next === 'keeping') {
      onKept();
      return;
    }
    setPhase(outcome);
  };
  const keep = () => {
    if (!busy && phase !== 'expired') void answer('keeping');
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
        {phase === 'failed' ? (
          <p role="alert" className="mt-2 text-sm text-slate-900 dark:text-slate-50">
            {ACCOUNT_SWITCH_FAILED}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        {phase === 'expired' ? (
          <a href={cloudSyncHref} className={BUTTON.primary}>
            Back to Cloud Sync
          </a>
        ) : (
          <>
            <button type="button" className={BUTTON.secondary} disabled={busy} onClick={keep}>
              Keep Current Account
            </button>
            <button
              ref={switchRef}
              type="button"
              className={BUTTON.primary}
              disabled={busy}
              onClick={() => void answer('switching')}
            >
              {phase === 'switching' ? 'Switching…' : 'Switch Account'}
            </button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
