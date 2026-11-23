'use client';

import { useId, useState } from 'react';
import {
  limitRow,
  SubscriptionRequestError,
  TEAM_REQUEST_NOTE_MAX,
  TIER_NAMES,
} from '@liveworkspace/subscription';
import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  Spinner,
  TextArea,
  useCopiedFlash,
} from '@liveworkspace/ui';
import { formatShortDay } from '../price';
import type { UpgradeTarget } from '../provider/context';
import { useBilling, useSubscription } from '../provider/hooks';

/** Where the request stands: not sent yet, on its way, sent (or asked already today, on that day), or refused. */
type Sent =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; fresh: boolean; at: number }
  | { state: 'failed'; message: string };

const REFUSALS: Record<string, string> = {
  not_team_member: 'Only a member of this team can ask its admins.',
  already_subscribed: 'This team already has Pro for Teams.',
  accounts_unavailable: 'Couldn’t confirm you’re in this team just now. Try again in a moment.',
  rate_limited: 'Too many tries in a row. Wait a minute and try again.',
  unauthorised: 'You’re signed out. Sign in and try again.',
};

function refusalOf(error: unknown): string {
  const code = error instanceof SubscriptionRequestError ? error.code : '';
  return REFUSALS[code] ?? 'Couldn’t send it. Check your connection and try again.';
}

const capitalise = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/**
 * Ask an Admin (subscription.md "Ask an Admin"). A member of a team on Free sends its admins a request for Pro for
 * Teams, with the limit that prompted it and a note: the admins find it in Settings, under Subscription, beside the
 * team. One a day per member and team; who the admins are is never shown. Copy Note stays for sending it some other
 * way.
 */
export function AskAdminDialog({
  target,
  onClose,
}: {
  target: UpgradeTarget;
  onClose: () => void;
}) {
  const titleId = useId();
  const noteId = useId();
  const load = useSubscription();
  const billing = useBilling();
  const team =
    load.status === 'ready' ? load.me.teams.find((t) => t.owner === target.owner) : undefined;
  const teamName = team?.name ?? null;
  const tier = TIER_NAMES.team;
  const [note, setNote] = useState(() => {
    const ask = `Could we move ${teamName ?? 'the team'} to ${tier}?`;
    return target.limit ? `We reached the limit for ${limitRow(target.limit).label}. ${ask}` : ask;
  });
  const { copied, flash } = useCopiedFlash();
  const [blocked, setBlocked] = useState(false);
  // Asked already today, as the service last said: the dialog opens saying so.
  const [sent, setSent] = useState<Sent>(() =>
    team?.askedAt !== undefined
      ? { state: 'sent', fresh: false, at: team.askedAt }
      : { state: 'idle' },
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setBlocked(false);
      flash();
    } catch {
      // A browser that refuses the clipboard: the note is selectable, and the line under it says so.
      setBlocked(true);
    }
  };

  const owner = target.owner;
  const canSend = !!billing && !!owner?.startsWith('t:');
  const send = async () => {
    if (!billing || !owner) return;
    setSent({ state: 'sending' });
    try {
      const answer = await billing.askTeam(owner, target.limit ?? null, note.trim() || null);
      setSent({ state: 'sent', fresh: answer.sent, at: answer.askedAt });
    } catch (error) {
      setSent({ state: 'failed', message: refusalOf(error) });
    }
  };

  const where = teamName ? `the admins of ${teamName}` : 'the team’s admins';
  const status =
    sent.state === 'sent'
      ? sent.fresh
        ? `Sent. ${capitalise(where)} see it in Settings, under Subscription.`
        : `You asked on ${formatShortDay(sent.at)}. ${capitalise(where)} still have it.`
      : sent.state === 'failed'
        ? sent.message
        : blocked
          ? 'Your browser didn’t allow copying. Select the note and copy it yourself.'
          : `Goes to ${where}, in Settings under Subscription. You can ask once a day.`;
  const done = sent.state === 'sent';

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="sm">
      <DialogHeader
        title={<span id={titleId}>Ask an Admin About Pro</span>}
        subtitle={
          teamName
            ? `Only an admin of ${teamName} can subscribe the team.`
            : 'Only a team admin can subscribe the team.'
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <label htmlFor={noteId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Your Note
        </label>
        <TextArea
          id={noteId}
          rows={4}
          maxLength={TEAM_REQUEST_NOTE_MAX}
          value={note}
          readOnly={done}
          onChange={(event) => setNote(event.target.value)}
        />
        <p
          role="status"
          data-ask-admin={sent.state}
          className={`text-xs leading-normal ${
            sent.state === 'failed'
              ? 'text-red-700 dark:text-red-300'
              : sent.state === 'sent'
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {status}
        </p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy Note'}
        </Button>
        {done ? (
          <Button onClick={onClose}>Done</Button>
        ) : canSend ? (
          <Button busy={sent.state === 'sending'} onClick={() => void send()}>
            {sent.state === 'sending' ? <Spinner /> : null}
            Send Request
          </Button>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
