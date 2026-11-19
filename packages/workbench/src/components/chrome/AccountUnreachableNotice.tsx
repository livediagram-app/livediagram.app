'use client';

// "Can't reach your account" (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site doesn't
// answer", "The editors"): what a page whose sign-in hint says signed in shows while the session's answer doesn't
// come, instead of settling as a guest and leaving for a guest hand-off to an accounts site that isn't answering (Work
// Tracker 1082). A standing warning toast (liveworkspace/docs/specs/016-notifications/toasts.md "Timing"): it stays
// while the account is not answering, with Try Again (a reload now), and leaves by itself once the session answers
// (AuthProvider stops drawing this). It never takes focus. AuthProvider draws it, inside the page's ToastProvider.

import { useEffect } from 'react';
import { useToast } from '@liveworkspace/ui/toast';

export const ACCOUNT_UNREACHABLE_KEY = 'account-unreachable';

export const ACCOUNT_UNREACHABLE_COPY = {
  message: 'Can’t reach your account. Your work is safe, and this page carries on once it answers.',
  retry: 'Try Again',
} as const;

const reload = () => window.location.reload();

export function AccountUnreachableNotice({ onRetry = reload }: { onRetry?: () => void }) {
  const toast = useToast();
  useEffect(() => {
    toast.action({
      key: ACCOUNT_UNREACHABLE_KEY,
      tone: 'warning',
      sticky: true,
      important: true,
      message: ACCOUNT_UNREACHABLE_COPY.message,
      actions: [{ label: ACCOUNT_UNREACHABLE_COPY.retry, onSelect: onRetry }],
    });
    return () => toast.dismissAction(ACCOUNT_UNREACHABLE_KEY);
  }, [toast, onRetry]);
  return null;
}
