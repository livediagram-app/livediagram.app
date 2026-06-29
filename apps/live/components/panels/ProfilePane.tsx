'use client';

// Profile pane (spec/65): the signed-in user's account home, rendered at
// /explorer/profile inside the normal Explorer chrome. Shows identity read
// from Clerk (avatar, name, email, join date — the page never writes
// identity, that's managed in Clerk), the two opt-out email-notification
// toggles, and the Danger zone that opens the delete-account confirmation.
//
// Clerk-gated the same way as AuthControls: when Clerk is disabled for the
// deployment (self-host without a publishable key, spec/03) there are no
// accounts, so the component is a no-op rather than calling Clerk hooks that
// would throw outside a ClerkProvider.

import { useAuth, useClerk, useUser } from '@clerk/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { clerkEnabled } from '@/lib/clerk-config';
import { track } from '@/lib/telemetry';
import {
  readUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';

// Lazy: the confirmation modal pulls in Clerk's reverification surface and
// most visits to the profile never delete, so it only loads on first click.
const DeleteAccountDialog = dynamic(() =>
  import('@/components/dialogs/DeleteAccountDialog').then((m) => m.DeleteAccountDialog),
);

function ProfilePaneEnabled() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { emailEnabled } = useCapabilities();
  const [prefs, setPrefs] = useState<UserPreferences>(() => readUserPreferences());
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Render nothing until Clerk resolves so we don't flash the sign-in
  // prompt for a user who is in fact signed in.
  if (!isLoaded) return null;
  if (!isSignedIn || !user) return <SignInPrompt />;

  const ownerId = user.id;
  const name =
    user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? 'Your account';
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  // Same initial-letter bubble as the header account button (AuthControls),
  // not the user's external (e.g. Google) avatar — keep the two consistent.
  const initial = (user.firstName ?? user.username ?? '?').slice(0, 1).toUpperCase();
  const joined = user.createdAt
    ? user.createdAt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Flip one notification preference. Telemetry fires BEFORE the write so the
  // event isn't lost if the user is simultaneously toggling other prefs
  // (spec/22 convention). `undefined === on`, so we default to true.
  const setFlag = (
    key:
      | 'notifyDiagramJoin'
      | 'notifyInviteResponse'
      | 'notifyComments'
      | 'notifyTips'
      | 'notifyMilestones',
    telemetryType: string,
  ) => {
    const on = !(prefs[key] !== false);
    track('UI', 'Toggled', on ? `${telemetryType}On` : `${telemetryType}Off`);
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    writeUserPreferences(next, ownerId);
  };

  return (
    <div className="space-y-8">
      {/* Identity card */}
      <section className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </h2>
          {email ? (
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">{email}</p>
          ) : null}
          {joined ? (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Joined {joined}</p>
          ) : null}
        </div>
      </section>

      {/* Email notifications — only when the deployment can actually send mail */}
      {emailEnabled ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Email notifications
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            We’ll email {email ?? 'you'} when one of these happens. Turn off the ones you don’t
            want.
          </p>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            <NotificationRow
              title="Someone joins my diagram"
              description="When a new person opens one of your shared diagrams for the first time."
              checked={prefs.notifyDiagramJoin !== false}
              onChange={() => setFlag('notifyDiagramJoin', 'NotifyDiagramJoin')}
            />
            <NotificationRow
              title="Someone responds to a team invite"
              description="When someone you invited accepts or declines, for teams you’re an admin of."
              checked={prefs.notifyInviteResponse !== false}
              onChange={() => setFlag('notifyInviteResponse', 'NotifyInviteResponse')}
            />
            <NotificationRow
              title="Someone comments on my diagram"
              description="When someone leaves a comment on a diagram you own."
              checked={prefs.notifyComments !== false}
              onChange={() => setFlag('notifyComments', 'NotifyComments')}
            />
            <NotificationRow
              title="Tips and check-ins"
              description="Occasional getting-started tips, and a friendly nudge if you’ve been away for a while."
              checked={prefs.notifyTips !== false}
              onChange={() => setFlag('notifyTips', 'NotifyTips')}
            />
            <NotificationRow
              title="Milestones"
              description="A note when you hit a milestone, like your first shared diagram."
              checked={prefs.notifyMilestones !== false}
              onChange={() => setFlag('notifyMilestones', 'NotifyMilestones')}
            />
          </div>
        </section>
      ) : null}

      {/* Danger zone */}
      <section>
        <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Danger zone</h3>
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Delete account</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Permanently removes your diagrams, folders, and account. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            Delete account
          </button>
        </div>
      </section>

      {deleteOpen ? (
        <DeleteAccountDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={async () => {
            // Backend + Clerk delete already completed inside the dialog;
            // sign out to clear client-side state and land on marketing.
            await signOut({ redirectUrl: '/' });
          }}
        />
      ) : null}
    </div>
  );
}

function NotificationRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  // The whole row is the click target (not just the switch), so the toggle is a
  // presentational <span> — nesting a real toggle button inside this button
  // would be invalid, and block <p>s can't live in a button either (use spans).
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ToggleSwitch presentational checked={checked} label={title} />
    </button>
  );
}

// A guest who deep-links /explorer/profile: there's no account to show, so
// nudge them to sign in (same shape as the Tokens pane's signed-out state).
function SignInPrompt() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Sign in to view your profile
      </p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Your profile, account, and notification settings live with your account.
      </p>
      <a
        href="/sign-in/"
        className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
      >
        Sign in
      </a>
    </div>
  );
}

function ProfilePaneDisabled() {
  // No accounts on this deployment — nothing to show.
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Profiles aren’t available on this deployment
      </p>
    </div>
  );
}

export const ProfilePane = clerkEnabled ? ProfilePaneEnabled : ProfilePaneDisabled;
