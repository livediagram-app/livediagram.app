'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { lucideGlyph, useClickOutside, useMenu, useMenuButton } from '@livediagram/ui';
import { lucideChevronDown, lucideKey, lucideUsers } from '@livediagram/icons/lucide';
import { signInHref } from '@/lib/accounts';
import { initials } from '@/lib/initials';
import { signOut, useSession } from '@/lib/session';

const noChange = () => () => {};

const ChevronIcon = lucideGlyph(lucideChevronDown, 16);
const TeamsIcon = lucideGlyph(lucideUsers, 16);
const KeyIcon = lucideGlyph(lucideKey, 16);

// The account pages the menu leads to.
const PAGES = [
  { href: '/account/teams', label: 'Teams', hint: 'Who you work with', Icon: TeamsIcon },
  { href: '/account/tokens', label: 'API tokens', hint: 'Connect tools and AI', Icon: KeyIcon },
];

// The header's account control (liveworkspace/docs/site.md "The header"): Sign in, or the signed-in
// person's avatar (their initials; accounts keep no pictures) and name, opening a menu of their
// Teams, API tokens and Sign out. Until the page knows who is signed in (lib/session.ts), it holds
// its place without showing either, so nothing jumps.
export function AccountControl() {
  const session = useSession();
  // This page, to come back to after signing in.
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/',
  );

  if (session.state === 'in') return <AccountMenu name={session.name} />;

  return (
    <a
      href={signInHref(here)}
      aria-hidden={session.state === 'checking' || undefined}
      tabIndex={session.state === 'checking' ? -1 : undefined}
      className={`relative touch-target-y rounded-md border border-slate-200 px-2.5 py-1.5 whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
        session.state === 'checking' ? 'invisible' : ''
      }`}
    >
      Sign in
    </a>
  );
}

function AccountMenu({ name }: { name: string }) {
  const [leaving, setLeaving] = useState(false);
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({ open, onClose: close, trigger, initialFocus });
  useClickOutside(ref, close, open);

  async function leave() {
    setLeaving(true);
    const left = await signOut();
    setLeaving(false);
    if (left) close();
  }

  const item =
    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:focus-visible:bg-slate-700/60';

  return (
    <div ref={ref} className="relative">
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}, account menu`}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={`relative touch-target-y inline-flex max-w-56 cursor-pointer items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-sm font-medium whitespace-nowrap text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
          open ? 'bg-slate-100 dark:bg-slate-800' : ''
        }`}
      >
        <Avatar name={name} />
        <span className="truncate max-sm:hidden">{name}</span>
        <ChevronIcon
          aria-hidden
          className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={attach}
          {...surfaceProps}
          aria-label="Account"
          className="absolute top-full right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
            <Avatar name={name} large />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">liveworkspace account</p>
            </div>
          </div>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          {PAGES.map(({ href, label, hint, Icon }) => (
            <a key={href} href={href} role="menuitem" tabIndex={-1} className={item}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-slate-900 dark:text-white">{label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
              </span>
            </a>
          ))}
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => void leave()}
            disabled={leaving}
            className={`${item} cursor-pointer`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <SignOutIcon />
            </span>
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

// An arrow leaving a door; the icon set has no sign-out glyph.
function SignOutIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-slate-500 dark:text-slate-400"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

// The signed-in person's initials in a disc, as the apps draw people.
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 font-semibold text-white dark:from-slate-300 dark:to-slate-500 dark:text-slate-950 ${
        large ? 'size-10 text-sm' : 'size-7 text-[11px]'
      }`}
    >
      <span className="text-optical-centre">{initials(name)}</span>
    </span>
  );
}
