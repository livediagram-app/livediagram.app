'use client';

// Invite by Link (livediagram's TeamInviteLinkDialog; liveworkspace/docs/accounts.md "The join link"): off until an
// admin turns it on; then the link to copy, when it ends, New Link (the old stops working) and Turn Off.

import { useId, useState } from 'react';
import { teamErrorMessage, type InviteLink, type TeamResult } from '../data/teams';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { TEAM_FIELD } from './TeamFormDialog';

const formatDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function InviteLinkDialog({
  teamName,
  link,
  onReset,
  onClear,
  onClose,
}: {
  teamName: string;
  link: InviteLink | null;
  onReset: () => Promise<TeamResult<unknown>>;
  onClear: () => Promise<TeamResult<unknown>>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fieldId = useId();

  async function change(run: () => Promise<TeamResult<unknown>>) {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await run();
    if (!result.ok) setError(teamErrorMessage(result.error));
    setBusy(false);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // No clipboard (an insecure context, a refused permission): the field is selected instead.
      const field = document.getElementById(fieldId) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    }
  }

  return (
    <Dialog onClose={onClose} ariaLabel="Invite by Link" size="md">
      <DialogHeader
        title="Invite by Link"
        subtitle={
          link
            ? `Anyone signed in who opens it joins ${teamName} as a member.`
            : `Turn on a link anyone signed in can use to join ${teamName} as a member. It works for 7 days.`
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-4" data-invite-link={link ? 'on' : 'off'}>
        {link ? (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor={fieldId} className="sr-only">
                Join link
              </label>
              <input
                id={fieldId}
                readOnly
                value={link.url}
                onFocus={(e) => e.currentTarget.select()}
                className={`${TEAM_FIELD} font-mono text-xs`}
              />
              <Button size="sm" onClick={() => void copy()} className="shrink-0">
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Works until {formatDate(link.expiresAt)}. A new link stops this one working.
            </p>
            {copied ? (
              <p role="status" className="sr-only">
                Link copied.
              </p>
            ) : null}
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void change(onReset)}>
            Turn On Link
          </Button>
        )}
        {error ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        {link ? (
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void change(onClear)}>
              Turn Off
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void change(onReset)}>
              New Link
            </Button>
          </>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
