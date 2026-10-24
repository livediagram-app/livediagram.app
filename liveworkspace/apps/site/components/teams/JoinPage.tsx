'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { accountApi, errorMessage, type JoinPreview } from '@/lib/account-api';
import { signInHref } from '@/lib/accounts';
import { joinTokenFrom, memberCountLabel, teamPath, INVITES_PATH } from '@/lib/teams';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { BUTTON } from '../settings/AccountShell';
import { TeamAvatar } from './Avatars';

const noChange = () => () => {};

// A team's join link, /join?token=… (liveworkspace/docs/accounts.md "The join link"). It shows the
// team before anything else: signed in, Join adds them as a member and opens the team in the Explorer; signed out,
// they sign in (or make an account) and come back to this same link; already in it, they go straight
// to the team. An off, expired or unknown link says so.
export function JoinPage() {
  const token = useSyncExternalStore(
    noChange,
    () => joinTokenFrom(window.location.search),
    () => undefined,
  );
  const [loaded, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'invalid' }
    | { kind: 'error'; error: string }
    | { kind: 'ready'; preview: JoinPreview }
  >({ kind: 'loading' });
  // No token in the address: nothing to look up.
  const state = token === null ? ({ kind: 'invalid' } as const) : loaded;
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void accountApi<JoinPreview>(`/join/${encodeURIComponent(token)}`).then((result) => {
      if (!live) return;
      if (result.ok && result.data.alreadyMember) {
        window.location.replace(teamPath(result.data.teamId));
        return;
      }
      setState(
        result.ok
          ? { kind: 'ready', preview: result.data }
          : result.error === 'invite_not_found'
            ? { kind: 'invalid' }
            : { kind: 'error', error: result.error },
      );
    });
    return () => {
      live = false;
    };
  }, [token]);

  async function join() {
    if (!token || state.kind !== 'ready') return;
    setBusy(true);
    setJoinError(null);
    const result = await accountApi<{ teamId: string }>(
      `/join/${encodeURIComponent(token)}`,
      'POST',
      {},
    );
    if (result.ok) {
      window.location.assign(teamPath(result.data.teamId));
      return;
    }
    setJoinError(result.error);
    setBusy(false);
  }

  const here = token ? `/join?token=${encodeURIComponent(token)}` : '/join';

  return (
    <JoinShell>
      {state.kind === 'loading' && (
        <div aria-busy className="flex flex-col items-center">
          <div className="size-16 animate-pulse rounded-3xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
          <div className="mt-5 h-7 w-48 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
        </div>
      )}
      {state.kind === 'invalid' && (
        <Notice
          title="This link isn’t valid"
          body="It may have expired or been turned off. Ask someone in the team for a new one."
        />
      )}
      {state.kind === 'error' && (
        <Notice title="Couldn’t open this link" body={errorMessage(state.error)} />
      )}
      {state.kind === 'ready' && (
        <div className="flex flex-col items-center text-center">
          <TeamAvatar id={state.preview.teamId} name={state.preview.teamName} size="lg" />
          <p className="mt-6 text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
            You’re invited to join
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight break-words text-slate-900 dark:text-white">
            {state.preview.teamName}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {[state.preview.organisation, memberCountLabel(state.preview.memberCount)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-4 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            A team is the same in every liveworkspace app: its work shows up for everyone in it.
          </p>
          {state.preview.signedIn ? (
            <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse">
              <button
                type="button"
                autoFocus
                disabled={busy}
                className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
                onClick={() => void join()}
              >
                {busy ? 'Joining…' : `Join ${state.preview.teamName}`}
              </button>
              <a
                href={INVITES_PATH}
                className={`${BUTTON.secondary} relative touch-target-y py-2.5`}
              >
                Not now
              </a>
            </div>
          ) : (
            <div className="mt-8 flex w-full flex-col items-center gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Teams are for liveworkspace accounts. Sign in, and you’ll come back here to join.
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse">
                <a
                  href={signInHref(here)}
                  className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
                >
                  Sign in to join
                </a>
                <a
                  href={`/sign-up?return=${encodeURIComponent(here)}`}
                  className={`${BUTTON.secondary} relative touch-target-y py-2.5`}
                >
                  Create an account
                </a>
              </div>
            </div>
          )}
          {joinError && (
            <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">
              {errorMessage(joinError)}
            </p>
          )}
        </div>
      )}
    </JoinShell>
  );
}

// The frame of the join and decline pages: the site's header and footer around one centred card.
export function JoinShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-xl shadow-slate-900/5 sm:px-10 sm:py-12 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

export function Notice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-slate-600 dark:text-slate-400">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        {children ?? (
          <a
            href={INVITES_PATH}
            className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
          >
            Go to your teams
          </a>
        )}
      </div>
    </div>
  );
}
