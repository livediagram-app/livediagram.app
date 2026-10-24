'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { accountApi, errorMessage } from '@/lib/account-api';
import { joinTokenFrom, INVITES_PATH } from '@/lib/teams';
import { BUTTON } from '../settings/AccountShell';
import { JoinShell, Notice } from './JoinPage';

const noChange = () => () => {};

type InviteState = 'invited' | 'declined' | 'expired' | 'joined';

// An invitation email's Decline link, /join/decline?token=… (liveworkspace/docs/accounts.md
// "Invitations"). Works signed in or out. Opening it only reads, so a mail scanner that follows the
// link changes nothing; only the button declines.
export function DeclinePage() {
  const token = useSyncExternalStore(
    noChange,
    () => joinTokenFrom(window.location.search),
    () => undefined,
  );
  const [loaded, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'invalid' }
    | { kind: 'error'; error: string }
    | { kind: 'ready'; teamName: string; status: InviteState }
  >({ kind: 'loading' });
  // No token in the address: nothing to look up.
  const state = token === null ? ({ kind: 'invalid' } as const) : loaded;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void accountApi<{ teamName: string; status: InviteState }>(
      `/invitations/decline/${encodeURIComponent(token)}`,
    ).then((result) => {
      if (!live) return;
      setState(
        result.ok
          ? { kind: 'ready', ...result.data }
          : result.error === 'invite_not_found'
            ? { kind: 'invalid' }
            : { kind: 'error', error: result.error },
      );
    });
    return () => {
      live = false;
    };
  }, [token]);

  async function decline() {
    if (!token || state.kind !== 'ready') return;
    setBusy(true);
    setError(null);
    const result = await accountApi<{ teamName: string; status: InviteState }>(
      `/invitations/decline/${encodeURIComponent(token)}`,
      'POST',
      {},
    );
    if (result.ok) setState({ kind: 'ready', ...result.data });
    else if (result.error === 'already_joined') setState({ ...state, status: 'joined' });
    else setError(result.error);
    setBusy(false);
  }

  return (
    <JoinShell>
      {state.kind === 'loading' && (
        <div
          aria-busy
          className="mx-auto h-24 max-w-sm animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      )}
      {state.kind === 'invalid' && (
        <Notice
          title="This invitation link isn’t valid"
          body="The invitation may have been withdrawn, or sent again with a new link."
        />
      )}
      {state.kind === 'error' && (
        <Notice title="Couldn’t open this invitation" body={errorMessage(state.error)} />
      )}
      {state.kind === 'ready' && state.status === 'invited' && (
        <Notice
          title={`Decline the invitation to ${state.teamName}?`}
          body="You won’t join the team, and its admins will see you declined. To accept instead, sign in with the address it was sent to."
        >
          <button
            type="button"
            disabled={busy}
            className="relative touch-target-y inline-flex cursor-pointer items-center justify-center rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-micro hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void decline()}
          >
            {busy ? 'Declining…' : 'Decline invitation'}
          </button>
          <a href={INVITES_PATH} className={`${BUTTON.secondary} relative touch-target-y py-2.5`}>
            See your invitations
          </a>
        </Notice>
      )}
      {state.kind === 'ready' && state.status === 'declined' && (
        <Notice
          title="Invitation declined"
          body={`You won’t join ${state.teamName}. Its admins can see you declined, and can invite you again later. Nothing else happens.`}
        />
      )}
      {state.kind === 'ready' && state.status === 'expired' && (
        <Notice
          title="This invitation has expired"
          body={`Nobody answered the invitation to ${state.teamName} within 28 days, so it closed. There’s nothing to decline.`}
        />
      )}
      {state.kind === 'ready' && state.status === 'joined' && (
        <Notice
          title={`You’re already in ${state.teamName}`}
          body="This link can’t undo a membership. To leave the team, open it from your teams."
        />
      )}
      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-rose-700 dark:text-rose-300">
          {errorMessage(error)}
        </p>
      )}
    </JoinShell>
  );
}
