'use client';

import { useEffect, useRef, useState } from 'react';
import type { TeamInviteLink } from '@livediagram/api-schema';
import { apiGenerateTeamInviteLink, apiRevokeTeamInviteLink } from '@/lib/api-client';
import { Dialog } from '@/components/dialogs/Dialog';
import { track } from '@/lib/telemetry';

// "Invite by link" (spec/32): the admin actively turns on a shareable
// join link that expires after a week. Anyone signed in who opens the
// URL can Join the team. Visual sibling of TeamFormModal (same backdrop
// + fly-up panel). The parent owns the inviteLink value (it lives on
// the team detail) and gets told when it changes so the rest of the
// pane stays in sync.

function joinUrlFor(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join?token=${encodeURIComponent(token)}`;
}

function expiryLabel(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return 'Expires within a day';
  return `Expires in ${days} days`;
}

export function TeamInviteLinkDialog({
  open,
  onClose,
  ownerId,
  teamId,
  inviteLink,
  onInviteLinkChange,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  teamId: string;
  inviteLink: TeamInviteLink | null;
  onInviteLinkChange: (link: TeamInviteLink | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError(null);
  }, [open]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const link = await apiGenerateTeamInviteLink(ownerId, teamId);
      track('Team', 'Shared', 'Link'); // spec/22: an invite link was turned on
      onInviteLinkChange(link);
      setCopied(false);
    } catch {
      setError('Could not create the link. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiRevokeTeamInviteLink(ownerId, teamId);
      track('Team', 'Removed', 'Link'); // spec/22: invite link turned off
      onInviteLinkChange(null);
    } catch {
      setError('Could not turn the link off. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!inviteLink) return;
    const url = joinUrlFor(inviteLink.token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure context / permissions): fall back
      // to selecting the field so the user can copy by hand.
      inputRef.current?.select();
    }
    track('UI', 'Copied', 'TeamInviteLink'); // spec/22: mirrors ShareLink/EmbedCode copies
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const url = inviteLink ? joinUrlFor(inviteLink.token) : '';

  return (
    <Dialog open={open} onClose={onClose} titleId="invite-link-title" size="sm">
      <div className="border-b border-slate-100 px-6 pt-6 pb-5 dark:border-slate-800">
        <h2
          id="invite-link-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Invite by link
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Anyone signed in who opens this link can join the team as a member. The link expires after
          a week, and you can turn it off any time.
        </p>

        {inviteLink ? (
          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Invite link
            </span>
            {/* Stacks on narrow screens so the URL field keeps its
                    width on mobile and the Copy button drops below it. */}
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => void copy()}
                className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 sm:py-1.5"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-400">
              {expiryLabel(inviteLink.expiresAt)}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LinkIcon />
              {busy ? 'Turning on…' : 'Turn on invite link'}
            </button>
          </div>
        )}

        {error ? <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        {inviteLink ? (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Turn off
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          Done
        </button>
      </div>
    </Dialog>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93M14 11a5 5 0 0 0-7.07 0L5.5 12.4a5 5 0 0 0 7.07 7.07L13.9 18.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
