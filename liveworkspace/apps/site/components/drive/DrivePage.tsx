'use client';

// The frame of liveworkspace's Drive pages (/drive/connect, /drive/connected, /drive/open): the site's header and
// footer around one centred card, as the join and pairing pages have it, and the parts each state is made of. Focus
// follows the heading at each state.
import { useSyncExternalStore, type ReactNode } from 'react';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import { BUTTON } from '../settings/account-ui';
import { JoinShell } from '../teams/JoinPage';

export { JoinShell as DriveShell };

const noChange = () => () => {};

/** This page's address (path and query), read in the browser; null while prerendered. */
export function useHere(): { search: string; path: string } | null {
  const search = useSyncExternalStore(
    noChange,
    () => window.location.search,
    () => null,
  );
  return search === null ? null : { search, path: `${window.location.pathname}${search}` };
}

// Each state keys its own heading, so a change mounts a fresh one, which takes focus.
const focusOnMount = (el: HTMLHeadingElement | null) => el?.focus();

export function DriveMessage({
  state,
  title,
  body,
  children,
}: {
  state: string;
  title: string;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="text-center" data-drive-page={state}>
      <h1
        key={state}
        ref={focusOnMount}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight text-slate-900 focus:outline-none dark:text-white"
      >
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-slate-600 dark:text-slate-400">{body}</p>
      {children ? (
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row-reverse">{children}</div>
      ) : null}
    </div>
  );
}

export function DriveWorking({ text }: { text: string }) {
  return (
    <p aria-busy className="text-center text-slate-600 dark:text-slate-400" role="status">
      {text}
    </p>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}>
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={`${BUTTON.secondary} relative touch-target-y py-2.5`}>
      {children}
    </a>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
    >
      {children}
    </button>
  );
}

/** Who is here: `checking`, `out` (a sign-in card instead of the page) or `in`. */
export function useSignedIn(): 'checking' | 'out' | 'in' {
  const session = useSession();
  return session.state;
}

export function SignInFirst({ here, title, body }: { here: string; title: string; body: string }) {
  return (
    <DriveMessage state="sign-in" title={title} body={body}>
      <PrimaryLink href={signInHref(here)}>Sign in</PrimaryLink>
    </DriveMessage>
  );
}
