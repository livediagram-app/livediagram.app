'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, ConfirmPopover } from '@liveworkspace/ui';
import { ErrorNote } from '../account-panels/error-note';
import { accountErrorMessage } from '../account-panels/errors';
import type { SettingsRowBase } from '../model';
import type { SettingsApiResult } from '../request';
import { SettingsRowShell } from '../SettingsRowShell';
import { lastSettingsResetAt } from './reset-signal';

// Reset All Settings, the row each editor draws in Account's Danger Zone directly above Delete Account (each app's
// docs/specs/007-editor/user-preferences.md; liveworkspace/docs/specs/010-site/site.md "Settings", "Reset All
// Settings"). Reset asks first, beside the button, since it can't be undone; then the host's `reset` runs
// (resetAccountSettings for an account, resetBrowserSettings for a guest or a self-hosted editor). A reset that landed
// says Settings Reset for a moment, across the redraw it causes; one refused says so under the row, with Try Again.

/** How long Settings Reset shows after a reset lands. */
export const RESET_DONE_MS = 4_000;

/** Where a reset reaches: every app's settings on the account, or this app's in this browser. */
export type ResetSettingsReach = 'account' | 'browser';

export const RESET_SETTINGS_ACCOUNT =
  'Puts every setting back to its default, in every liveworkspace app. Your profile, API tokens, webhooks and sign-ins stay as they are.';
export const RESET_SETTINGS_BROWSER =
  'Puts every setting in this app back to its default, in this browser.';

const QUESTION: Record<ResetSettingsReach, string> = {
  account:
    'Reset all your settings? Every liveworkspace app goes back to its defaults, on every device you sign in to. Tours will offer again.',
  browser:
    'Reset all your settings? Every setting in this app goes back to its default, in this browser. Tours will offer again.',
};

type Phase = 'idle' | 'resetting' | 'done' | { failed: string };

// The words for a refusal: what happened, and why where the API said something more useful than "try again".
const GENERAL = accountErrorMessage('');
function failedMessage(error: string): string {
  const why = accountErrorMessage(error);
  return why === GENERAL
    ? 'Your settings weren’t reset. Please try again.'
    : `Your settings weren’t reset. ${why}`;
}

export function ResetSettingsRow({
  row,
  reach,
  reset,
}: {
  row: Pick<SettingsRowBase, 'key' | 'label' | 'description' | 'helpArticle'>;
  reach: ResetSettingsReach;
  reset: () => Promise<SettingsApiResult<unknown>>;
}) {
  // A reset that landed a moment ago (this row drawn again by it) still says so, for the rest of its moment.
  const [phase, setPhase] = useState<Phase>(() =>
    Date.now() - lastSettingsResetAt() < RESET_DONE_MS ? 'done' : 'idle',
  );
  const doneAt = useRef(lastSettingsResetAt());
  const [confirming, setConfirming] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);
  const live = useRef(true);
  const refocus = useRef(false);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Settings Reset gives way to the button again. The button it replaced had the keyboard, so the note takes it,
  // unless something else on the page has it by now.
  useEffect(() => {
    if (phase !== 'done') return;
    const left = Math.max(0, RESET_DONE_MS - (Date.now() - doneAt.current));
    const timer = setTimeout(() => {
      // The note had the keyboard: the button it gives way to takes it back.
      refocus.current = document.activeElement === doneRef.current;
      setPhase('idle');
    }, left);
    if (document.activeElement === document.body || !document.activeElement) {
      doneRef.current?.focus();
    }
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'idle' || !refocus.current) return;
    refocus.current = false;
    buttonRef.current?.focus();
  }, [phase]);

  const run = async () => {
    setPhase('resetting');
    let result: SettingsApiResult<unknown>;
    try {
      result = await reset();
    } catch {
      result = { ok: false, status: 0, error: 'offline' };
    }
    if (!live.current) return;
    doneAt.current = Date.now();
    setPhase(result.ok ? 'done' : { failed: result.error });
  };

  const failed = typeof phase === 'object' ? phase.failed : null;

  return (
    <SettingsRowShell
      row={{
        ...row,
        description: reach === 'account' ? RESET_SETTINGS_ACCOUNT : RESET_SETTINGS_BROWSER,
      }}
      control={
        phase === 'done' ? (
          <span
            ref={doneRef}
            tabIndex={-1}
            role="status"
            data-reset-settings-done
            className="shrink-0 text-xs font-medium text-emerald-700 outline-none dark:text-emerald-400"
          >
            Settings Reset
          </span>
        ) : (
          <Button
            ref={buttonRef}
            variant="secondary"
            size="sm"
            aria-haspopup="dialog"
            // Busy while it resets: the keyboard stays on it, which a disabled button would drop.
            busy={phase === 'resetting'}
            onClick={(event) => setConfirming(event.currentTarget)}
            className="shrink-0"
          >
            {phase === 'resetting' ? 'Resetting…' : 'Reset'}
          </Button>
        )
      }
    >
      {failed !== null ? (
        <ErrorNote>
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span>{failedMessage(failed)}</span>
            <Button variant="secondary" size="xs" onClick={() => void run()} className="shrink-0">
              Try Again
            </Button>
          </span>
        </ErrorNote>
      ) : null}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming}
          message={QUESTION[reach]}
          warning="This can’t be undone."
          confirmLabel="Reset"
          onConfirm={() => {
            setConfirming(null);
            // The keyboard waits on the busy button, not the page, while it resets.
            buttonRef.current?.focus();
            void run();
          }}
          onCancel={() => {
            setConfirming(null);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </SettingsRowShell>
  );
}
