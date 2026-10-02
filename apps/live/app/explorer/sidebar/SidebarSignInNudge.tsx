'use client';

import Link from 'next/link';
import { SignInIcon } from '@/components/chrome/AuthControls';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from '../ExplorerContext';

// One sign-in nudge, in place of per-section nudges, when auth is
// configured but the visitor is signed out (docs/specs/013-workspace/teams.md).
export function SidebarSignInNudge() {
  const { teamsEnabled } = useExplorer();
  const { signInHref } = useAuthHrefs();
  if (!clerkEnabled || teamsEnabled) return null;
  return (
    <Link
      href={signInHref}
      className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-3 text-left transition hover:border-brand-300 hover:from-brand-100 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/40 dark:hover:border-brand-500/50"
    >
      <span className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400">
        <SignInIcon />
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-100">
          Sign in to access Teams
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Free, and your guest documents come with you.
        </span>
      </span>
    </Link>
  );
}
