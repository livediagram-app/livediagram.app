'use client';

// "Can't reach your account right now" (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site
// doesn't answer", "The editors"): what a page whose sign-in hint says signed in shows while the session's answer
// doesn't come, instead of settling as a guest and leaving for a guest hand-off to an accounts site that isn't
// answering (Work Tracker 1082). Calm and non-blocking, in the toast's look: a polite status that never takes focus,
// bottom centre and raised clear of the canvas's bottom-right cluster, so it never covers the zoom controls on a phone
// (corner-cluster-clearance.ts). The page carries on by itself once the session answers; Try Again reloads it now.
// AuthProvider draws it.

import { lucideCloudAlert } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph } from '@liveworkspace/ui';
import { TOAST_SURFACE } from '../toast/ToastCard';
import { CORNER_CLUSTER_CLEARANCE } from './corner-cluster-clearance';

const CloudAlertIcon = lucideGlyph(lucideCloudAlert, 18);

export const ACCOUNT_UNREACHABLE_COPY = {
  title: 'Can’t reach your account right now',
  body: 'Your work is safe. This page carries on by itself as soon as your account answers.',
  retry: 'Try Again',
} as const;

export function AccountUnreachableNotice({
  onRetry = () => window.location.reload(),
}: {
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      data-account-unreachable=""
      className={`fixed ${CORNER_CLUSTER_CLEARANCE} left-1/2 z-[var(--z-toast)] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 animate-toast-in items-start gap-3 border-slate-200 px-4 py-3 text-sm dark:border-slate-700 ${TOAST_SURFACE}`}
    >
      <span aria-hidden className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400">
        <CloudAlertIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{ACCOUNT_UNREACHABLE_COPY.title}</p>
        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{ACCOUNT_UNREACHABLE_COPY.body}</p>
      </div>
      <Button size="sm" className="shrink-0 self-center" onClick={onRetry}>
        {ACCOUNT_UNREACHABLE_COPY.retry}
      </Button>
    </div>
  );
}
