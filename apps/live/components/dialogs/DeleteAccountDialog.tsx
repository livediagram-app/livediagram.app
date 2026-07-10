'use client';

// Account-deletion confirmation modal. Triggered from the
// AuthControls dropdown's "Delete account" item. The user types
// their primary email to confirm — a typo-resistant gate that's
// harder to miss-click than a single "Are you sure?" button.
//
// Delete sequence:
//
//   1. POST DELETE /api/account — wipes the caller's diagrams +
//      folders + participant row on the backend. Returns the change
//      counts on success.
//   2. Clerk's `user.delete()` — drops the Clerk account itself.
//   3. Sign out + redirect to /live/ — by the time the page reloads
//      the editor lands as a fresh guest.
//
// Backend-first because a backend failure leaves the user signed in
// with data they can recover from; Clerk-first would leave orphan
// rows behind that the user could no longer reach.

import { Button } from '@livediagram/ui';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { Portal } from '@/components/primitives/Portal';
import { useEffect, useRef, useState } from 'react';
import { apiDeleteAccount } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { useEscape } from '@/hooks/ui/useEscape';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import { messageOf } from '@/components/chrome/auth-shared';

type Phase = 'idle' | 'submitting' | 'error';

export function DeleteAccountDialog({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}) {
  // Silence the canvas shortcut/paste listeners behind the modal
  // (see lib/modal-guard).
  useModalGuard(open);
  const { user, deleteAccount } = useDeferredAuth();
  const expectedEmail = user?.email ?? '';
  // `deleteAccount` wraps Clerk's `user.delete()` in the reverification
  // flow (step-up auth modal, built inside ClerkBridge where the Clerk
  // context lives) — destructive actions require fresh verification
  // even for already-signed-in users.

  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // Reset state every time the dialog opens. Without this, a user
  // who cancels mid-flow and re-opens it sees a stale typed value
  // and possibly a stale error.
  useEffect(() => {
    if (open) {
      setTyped('');
      setPhase('idle');
      setErrorMsg('');
      // Focus the input on next tick so the modal mount completes
      // first — focusing during render is silently dropped.
      const handle = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(handle);
    }
  }, [open]);

  // Escape closes, same convention as other modals (ShareDialog).
  // Disabled mid-submit so the user can't cancel a request that's
  // already in flight.
  useEscape(onClose, { enabled: open && phase !== 'submitting' });

  if (!open) return null;

  const emailsMatch =
    expectedEmail.length > 0 && typed.trim().toLowerCase() === expectedEmail.toLowerCase();

  const handleDelete = async () => {
    if (!emailsMatch || phase === 'submitting' || !user || !deleteAccount) return;
    setPhase('submitting');
    setErrorMsg('');
    const result = await apiDeleteAccount();
    if (!result) {
      setPhase('error');
      setErrorMsg('Could not delete server-side data. Try again.');
      return;
    }
    // Anonymous, no identifier: the account-lifecycle counter for the
    // Acquisition dashboard (spec/22). Fired now, after the server data is
    // gone but before sign-out, so the opt-out itself still reaches the wire.
    track('Session', 'Deleted', 'Account');
    try {
      await deleteAccount();
    } catch (err) {
      // Backend data is already gone, so surface Clerk's actual
      // error rather than swallowing it. With the reverification
      // wrapper this should usually only fire for harder problems
      // (self-deletion disabled on the Clerk instance, stale
      // token, network blip). If it says self-deletion is disabled,
      // the toggle lives at Clerk Dashboard → User & Authentication
      // → Personal information → Delete account.
      setPhase('error');
      const detail = messageOf(err, 'Clerk delete failed');
      setErrorMsg(
        `Backend data was deleted, but removing the Clerk account failed: ${detail}. ` +
          'If this says self-deletion is disabled, enable it in your Clerk dashboard → User & Authentication → Personal information → Delete account.',
      );
      return;
    }
    await onDeleted();
  };

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
          className="pointer-events-auto flex w-[28rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
            <h2
              id="delete-account-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Delete account
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              This permanently removes your diagrams, folders, and participant record from the
              livediagram server, then deletes your account. This cannot be undone.
            </p>
          </div>

          <div className="px-6 py-5">
            <label
              htmlFor="delete-confirm-email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Type{' '}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {expectedEmail || 'your email address'}
              </strong>{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              id="delete-confirm-email"
              type="email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={phase === 'submitting'}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-rose-500/20"
              placeholder="you@example.com"
            />

            {phase === 'error' && errorMsg ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {errorMsg}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose} disabled={phase === 'submitting'}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={!emailsMatch || phase === 'submitting'}
              className="shadow-sm"
            >
              {phase === 'submitting' ? 'Deleting…' : 'Delete account'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
