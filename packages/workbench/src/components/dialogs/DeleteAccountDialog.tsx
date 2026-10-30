'use client';

// Delete Account, every editor's (each product's docs/specs/014-identity/auth-and-guest-access.md "Deleting an
// account"); a product binds its name, its api and its telemetry. Two steps in one dialog:
//
//   1. Confirm: the warning, then the person types their email (a typo-resistant gate, harder to miss-click than one
//      "Are you sure?") and asks for a code: POST /api/account/deletion-code emails a 6-digit code to the account.
//   2. Code: the sign-in page's six boxes (CodeDigits). Delete Account sends the code with DELETE /api/account, whose
//      server checks it before anything is deleted, deletes the app's data, then closes the liveworkspace account with
//      it. Being signed in is not enough: someone at a machine left signed in can't get past this without the inbox.
//
// Then `deleteAccount()` ends this app's session, and `onDeleted` reloads to the landing page as a fresh guest.

import {
  Button,
  CODE_DIGITS,
  CodeDigits,
  EMPTY_CODE,
  Portal,
  useEscape,
  useFocusTrap,
  type CodeDigitsHandle,
} from '@liveworkspace/ui';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useModalGuard } from '../../hooks/ui/useModalGuard';
import type { AccountDeletion, DeletionCodeSent } from '../../lib/account-deletion';
import { useDeferredAuth } from '../providers/deferred-auth';
import { DialogFooter } from './DialogFooter';

type Step = 'confirm' | 'code';
type Busy = null | 'sending' | 'resending' | 'deleting';

export interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
  // This app's name ('livediagram') and what its This Browser items are called ('Canvases').
  appName: string;
  localItems: string;
  sendCode: () => Promise<DeletionCodeSent>;
  deleteAccount: (code: string) => Promise<AccountDeletion>;
  // The account-lifecycle counter, fired once the server data is gone but before sign-out, so it still reaches the
  // wire.
  onDataDeleted?: () => void;
}

const SEND_REFUSED: Record<Exclude<DeletionCodeSent, 'sent'>, string> = {
  rate_limited: 'Too many codes asked for. Wait a minute and try again.',
  failed: 'We could not send a code. Try again.',
};

function refusalOf(result: Exclude<AccountDeletion, 'deleted'>, appName: string): string {
  switch (result) {
    case 'invalid_code':
      return 'That code is wrong or has expired. Nothing was deleted.';
    case 'too_many_attempts':
      return 'Too many wrong codes, so that one no longer works. Nothing was deleted. Send a new code.';
    case 'rate_limited':
      return 'Too many attempts. Wait a minute and try again.';
    case 'account_not_closed':
      return `Your ${appName} data was deleted, but closing your liveworkspace account failed. Try again.`;
    case 'failed':
      return 'Could not delete server-side data. Try again.';
  }
}

const messageOf = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'unknown error';

export function DeleteAccountDialog({
  open,
  onClose,
  onDeleted,
  appName,
  localItems,
  sendCode,
  deleteAccount: deleteOnServer,
  onDataDeleted,
}: DeleteAccountDialogProps) {
  // Silence the canvas shortcut/paste listeners behind the modal (lib/modal-guard).
  useModalGuard(open);
  const { user, deleteAccount: endSession } = useDeferredAuth();
  const expectedEmail = user?.email ?? '';

  const [step, setStep] = useState<Step>('confirm');
  const [typed, setTyped] = useState('');
  const [digits, setDigits] = useState<readonly string[]>(EMPTY_CODE);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wrongCode, setWrongCode] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<CodeDigitsHandle>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // Back to the start every time the dialog opens (adjusted during render), so a person who cancels mid-flow and
  // opens it again never meets a stale email, code or error.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('confirm');
      setTyped('');
      setDigits(EMPTY_CODE);
      setBusy(null);
      setError('');
      setNotice('');
      setWrongCode(false);
    }
  }
  // The step's first field takes focus on the next tick, once the modal has mounted: focusing during render is
  // silently dropped.
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(
      () => (step === 'code' ? codeRef.current?.focus() : emailRef.current?.focus()),
      30,
    );
    return () => window.clearTimeout(handle);
  }, [open, step]);

  // Escape closes, as in every modal, except while a request is in flight.
  useEscape(onClose, { enabled: open && busy === null });

  if (!open) return null;

  const emailsMatch =
    expectedEmail.length > 0 && typed.trim().toLowerCase() === expectedEmail.toLowerCase();
  const code = digits.join('');
  const working = busy !== null;

  const requestCode = async (again: boolean) => {
    if (working) return;
    setBusy(again ? 'resending' : 'sending');
    setError('');
    setNotice('');
    const sent = await sendCode().catch((): DeletionCodeSent => 'failed');
    setBusy(null);
    if (sent !== 'sent') {
      setError(SEND_REFUSED[sent]);
      return;
    }
    setDigits(EMPTY_CODE);
    setWrongCode(false);
    if (again) {
      setNotice('We sent you a new code. The one before no longer works.');
      // After the render that enables the boxes again: a disabled box takes no focus.
      requestAnimationFrame(() => codeRef.current?.focus());
    }
    setStep('code');
  };

  const onConfirm = (event: FormEvent) => {
    event.preventDefault();
    if (emailsMatch) void requestCode(false);
  };

  const onDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (working || code.length !== CODE_DIGITS || !user || !endSession) return;
    setBusy('deleting');
    setError('');
    setNotice('');
    const result = await deleteOnServer(code).catch((): AccountDeletion => 'failed');
    if (result !== 'deleted') {
      setBusy(null);
      setError(refusalOf(result, appName));
      if (result === 'invalid_code' || result === 'too_many_attempts') {
        setWrongCode(true);
        setDigits(EMPTY_CODE);
        // After the render that enables the boxes again: a disabled box takes no focus.
        requestAnimationFrame(() => codeRef.current?.focus());
      }
      return;
    }
    onDataDeleted?.();
    try {
      await endSession();
    } catch (err) {
      // The data is already gone; only ending the session failed (a network blip). Signing out finishes it.
      setBusy(null);
      setError(
        `Your ${appName} data was deleted, but signing you out failed: ${messageOf(err)}. Sign out to finish.`,
      );
      return;
    }
    await onDeleted();
  };

  const strong = 'font-semibold text-slate-900 dark:text-slate-100';

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-none fixed inset-0 z-[var(--z-modal)] flex items-center justify-center"
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-description"
          className="pointer-events-auto flex w-[28rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <form onSubmit={step === 'confirm' ? onConfirm : (e) => void onDelete(e)} noValidate>
            <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
              <h2
                id="delete-account-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Delete Account
              </h2>
              {step === 'confirm' ? (
                // Closing the account deletes what the person owns in every app, not just this one, so it says
                // so first.
                <div
                  id="delete-account-description"
                  className="mt-2 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <p>
                    This permanently deletes your liveworkspace account and{' '}
                    <strong className={strong}>
                      everything you own in every liveworkspace app
                    </strong>
                    , not just {appName}:
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      every canvas, plan, document and design in livediagram, liveplanner,
                      livedocuments and livedesign, including the Trash
                    </li>
                    <li>your folders, settings and API tokens</li>
                    <li>any team you run on your own</li>
                  </ul>
                  <p>
                    You will be signed out of every app.{' '}
                    <strong className={strong}>This can’t be undone.</strong> {localItems} in This
                    Browser stay on this device.
                  </p>
                </div>
              ) : (
                <p
                  id="delete-account-description"
                  className="mt-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  We emailed a 6-digit code to <strong className={strong}>{expectedEmail}</strong>.
                  Enter it to delete your account. It works for 10 minutes.
                </p>
              )}
            </div>

            <div className="px-6 py-5">
              {step === 'confirm' ? (
                <>
                  <label
                    htmlFor="delete-confirm-email"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Type <strong className={strong}>{expectedEmail || 'your email address'}</strong>{' '}
                    to confirm
                  </label>
                  <input
                    ref={emailRef}
                    id="delete-confirm-email"
                    type="email"
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={working}
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-rose-500/20"
                    placeholder="you@example.com"
                  />
                </>
              ) : (
                <>
                  <CodeDigits
                    ref={codeRef}
                    label="Deletion code"
                    digits={digits}
                    onDigits={(next) => {
                      setDigits(next);
                      setWrongCode(false);
                    }}
                    disabled={working}
                    invalid={wrongCode}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <span>Didn’t get it? Check your spam folder.</span>
                    <button
                      type="button"
                      onClick={() => void requestCode(true)}
                      disabled={working}
                      className="relative touch-target-y cursor-pointer font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:decoration-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:decoration-slate-600 dark:hover:decoration-slate-400"
                    >
                      {busy === 'resending' ? 'Sending…' : 'Resend Code'}
                    </button>
                  </div>
                </>
              )}

              {notice ? (
                <p
                  role="status"
                  className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {notice}
                </p>
              ) : null}
              {error ? (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {error}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={onClose} disabled={working}>
                Cancel
              </Button>
              {step === 'confirm' ? (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!emailsMatch || working}
                  className="shadow-sm"
                >
                  {busy === 'sending' ? 'Sending Code…' : 'Email Me a Code'}
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={code.length !== CODE_DIGITS || working}
                  className="shadow-sm"
                >
                  {busy === 'deleting' ? 'Deleting…' : 'Delete Account'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </div>
      </div>
    </Portal>
  );
}
