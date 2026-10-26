'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '../SettingsRowShell';

// The Profile's Sign-in and Security (liveworkspace/docs/site.md "Settings", "Profile"): how the person signs in and
// where they are signed in, from the accounts Worker's own session endpoints. Only liveworkspace.app can reach them
// (they are the session's), so the host hands them over as `AccountSecurity`; elsewhere the Profile links there.

/** One place the person is signed in. */
export type AccountSession = {
  id: string;
  // What revokes it.
  token: string;
  current: boolean;
  userAgent: string | null;
  // ISO times.
  createdAt: string;
  updatedAt: string;
};

/** The ways in: an emailed code always; Google connected, connectable, or not offered here. */
export type AccountSignInMethods = { google: 'connected' | 'available' | 'off' };

/** What liveworkspace.app's session can do for Sign-in and Security. Each answers null (or false) when refused. */
export type AccountSecurity = {
  sessions: () => Promise<AccountSession[] | null>;
  revokeSession: (token: string) => Promise<boolean>;
  revokeOtherSessions: () => Promise<boolean>;
  signInMethods: () => Promise<AccountSignInMethods | null>;
  // Starts linking Google (the browser leaves for Google and comes back).
  connectGoogle: () => Promise<boolean>;
};

const ERROR_NOTE =
  'mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

// The read, `reload` (read again, keeping what shows meanwhile) and `retry` (after a failure: loading again).
function useLoad<T>(read: () => Promise<T | null>): [Load<T>, () => void, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    let live = true;
    void read().then(
      (data) => live && setLoad(data === null ? { state: 'error' } : { state: 'ready', data }),
      () => live && setLoad({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [read, turn]);
  const reload = useCallback(() => setTurn((n) => n + 1), []);
  const retry = useCallback(() => {
    setLoad({ state: 'loading' });
    setTurn((n) => n + 1);
  }, []);
  return [load, reload, retry];
}

function TryAgain({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative touch-target ml-2 cursor-pointer font-semibold underline underline-offset-2 hover:no-underline"
    >
      Try again
    </button>
  );
}

function MethodTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200"
    >
      {children}
    </span>
  );
}

function StatusPill({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        on
          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
      }`}
    >
      {children}
    </span>
  );
}

const MailGlyph = () => (
  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="2" />
    <path d="m3.5 6 6.5 5 6.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Google's "G", in its colours: a provider's mark, as a sign-in button shows it.
const GoogleGlyph = () => (
  <svg viewBox="0 0 20 20" className="size-5">
    <path
      fill="#4285F4"
      d="M18.2 10.2c0-.6-.1-1.2-.2-1.7H10v3.3h4.6a4 4 0 0 1-1.7 2.6v2.1h2.8c1.6-1.5 2.5-3.7 2.5-6.3z"
    />
    <path
      fill="#34A853"
      d="M10 18.5c2.3 0 4.2-.8 5.7-2.1l-2.8-2.1c-.8.5-1.7.8-2.9.8-2.2 0-4.1-1.5-4.8-3.5H2.3v2.2A8.5 8.5 0 0 0 10 18.5z"
    />
    <path fill="#FBBC05" d="M5.2 11.6a5 5 0 0 1 0-3.2V6.2H2.3a8.5 8.5 0 0 0 0 7.6z" />
    <path
      fill="#EA4335"
      d="M10 4.9c1.3 0 2.4.4 3.3 1.3l2.5-2.5A8.5 8.5 0 0 0 2.3 6.2l2.9 2.2C5.9 6.4 7.8 4.9 10 4.9z"
    />
  </svg>
);

/** Sign-in Methods: an emailed code to the account's address, and Google. */
export function SignInMethodsRows({
  security,
  email,
}: {
  security: AccountSecurity;
  email?: string | null;
}) {
  const [load, , retry] = useLoad(security.signInMethods);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const google = load.state === 'ready' ? load.data.google : null;
  return (
    <>
      <SettingsRowShell
        row={{
          key: 'signInEmail',
          label: 'Email Code',
          description: email
            ? `A one-time code sent to ${email}. Always on: it is how your address is checked.`
            : 'A one-time code sent to your email. Always on: it is how your address is checked.',
        }}
        leading={
          <MethodTile>
            <MailGlyph />
          </MethodTile>
        }
        control={<StatusPill on>On</StatusPill>}
      />
      {google === 'off' ? null : (
        <SettingsRowShell
          row={{
            key: 'signInGoogle',
            label: 'Google',
            description:
              google === 'connected'
                ? 'Connected. Continue with Google signs you in to this account.'
                : 'Sign in with one click, using the Google account with this address.',
          }}
          leading={
            <MethodTile>
              <GoogleGlyph />
            </MethodTile>
          }
          control={
            load.state === 'loading' ? (
              <span
                aria-busy
                className="h-6 w-20 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none dark:bg-slate-700"
              />
            ) : google === 'connected' ? (
              <StatusPill on>Connected</StatusPill>
            ) : (
              <button
                type="button"
                className={SETTINGS_ROW_BUTTON}
                disabled={connecting || load.state === 'error'}
                onClick={async () => {
                  setConnecting(true);
                  setFailed(false);
                  const ok = await security.connectGoogle();
                  if (!ok) {
                    setConnecting(false);
                    setFailed(true);
                  }
                }}
              >
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            )
          }
        >
          {load.state === 'error' ? (
            <p role="alert" className={ERROR_NOTE}>
              Couldn’t reach your account just now.
              <TryAgain onClick={retry} />
            </p>
          ) : failed ? (
            <p role="alert" className={ERROR_NOTE}>
              Couldn’t reach your account just now. Try again in a moment.
            </p>
          ) : null}
        </SettingsRowShell>
      )}
    </>
  );
}

/** A browser and system from a user agent, in words ("Chrome on macOS"). */
export function deviceName(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const system = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}

const isPhone = (ua: string | null) => /iPhone|Android.+Mobile/.test(ua ?? '');

function lastActive(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 2) return 'Active now';
  if (minutes < 60) return `Active ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Active ${days} day${days === 1 ? '' : 's'} ago`;
  return `Active ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

const LaptopGlyph = () => (
  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="4" y="4.5" width="12" height="8.5" rx="1.5" />
    <path d="M2.5 15.5h15" strokeLinecap="round" />
  </svg>
);
const PhoneGlyph = () => (
  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="6" y="2.75" width="8" height="14.5" rx="2" />
    <path d="M9 14.5h2" strokeLinecap="round" />
  </svg>
);

function signedInSince(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'Signed in here';
  return `Signed in here since ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
}

/** Where You're Signed In: each session, this device first, signing out of any other. */
export function SessionsRows({ security }: { security: AccountSecurity }) {
  const [load, reload, retry] = useLoad(security.sessions);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Sessions signed out here, left out at once: the list is read again after, and until that answer came the
  // signed-out row stayed with its Sign Out button live again, so it could be pressed twice. `others` is every
  // session but this one.
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [now] = useState(() => Date.now());

  async function act(id: string, run: () => Promise<boolean>) {
    setBusy(id);
    setFailed(false);
    const ok = await run().catch(() => false);
    setBusy(null);
    if (ok) {
      setGone((was) => new Set(was).add(id));
      reload();
    } else setFailed(true);
  }

  if (load.state !== 'ready') {
    return (
      <SettingsRowShell
        row={{ key: 'sessions', label: 'Where You’re Signed In', description: '' }}
        descriptionContent={
          load.state === 'error' ? (
            <span role="alert">
              Couldn’t load your sessions just now.
              <TryAgain onClick={retry} />
            </span>
          ) : (
            <span
              aria-busy
              className="block h-3 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-700"
            />
          )
        }
      />
    );
  }
  const sessions = load.data
    .filter((s) => s.current || !(gone.has(s.id) || gone.has('others')))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  const others = sessions.filter((s) => !s.current).length;
  return (
    <>
      {sessions.map((session) => (
        <SettingsRowShell
          key={session.id}
          row={{
            key: `session-${session.id}`,
            label: deviceName(session.userAgent),
            description: session.current
              ? signedInSince(session.createdAt)
              : lastActive(session.updatedAt, now),
          }}
          leading={
            <MethodTile>{isPhone(session.userAgent) ? <PhoneGlyph /> : <LaptopGlyph />}</MethodTile>
          }
          control={
            session.current ? (
              <StatusPill on>This device</StatusPill>
            ) : (
              <button
                type="button"
                className={SETTINGS_ROW_BUTTON}
                disabled={busy !== null}
                aria-label={`Sign out of ${deviceName(session.userAgent)}`}
                onClick={() => void act(session.id, () => security.revokeSession(session.token))}
              >
                {busy === session.id ? 'Signing out…' : 'Sign Out'}
              </button>
            )
          }
        />
      ))}
      {others > 0 ? (
        <SettingsRowShell
          row={{
            key: 'sessionsOthers',
            label: 'Sign Out Everywhere Else',
            description: `Ends ${others === 1 ? 'the other session' : `all ${others} other sessions`}. This device stays signed in.`,
          }}
          control={
            <button
              type="button"
              className={SETTINGS_ROW_BUTTON}
              disabled={busy !== null}
              onClick={() => void act('others', security.revokeOtherSessions)}
            >
              {busy === 'others' ? 'Signing out…' : 'Sign Out Others'}
            </button>
          }
        >
          {failed ? (
            <p role="alert" className={ERROR_NOTE}>
              Couldn’t sign that session out. Try again in a moment.
            </p>
          ) : null}
        </SettingsRowShell>
      ) : failed ? (
        <p role="alert" className={`mx-4 mb-3 ${ERROR_NOTE}`}>
          Couldn’t sign that session out. Try again in a moment.
        </p>
      ) : null}
    </>
  );
}
