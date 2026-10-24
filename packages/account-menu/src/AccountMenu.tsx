'use client';

import {
  type CSSProperties,
  useRef,
  useState,
  type ComponentType,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { avatarFill, initials } from './initials';

// The signed-in person's account menu (liveworkspace/docs/site.md "The header"): their avatar (initials; accounts
// keep no pictures) and name, opening a menu of their API tokens, Settings and Sign out. One component for
// liveworkspace.app's header, the Explorer on an app's address and every app's marketing header.
//
// Each caller passes its own UI package's menu hooks and icons (the kit), so the menu keeps the keyboard and focus
// behaviour every app's menus share (WAI-ARIA Menu Button) and the house icons, without this package depending on
// any one product.

type IconComponent = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;

/** What a UI package's `useMenuButton` gives: the trigger's state and handlers. */
export type AccountMenuButton<Focus = unknown> = {
  open: boolean;
  close: () => void;
  toggle: () => void;
  trigger: HTMLElement | null;
  setTrigger: (el: HTMLElement | null) => void;
  initialFocus: Focus;
  onTriggerKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
};

/** The menu hooks and icons of the caller's UI package (`@livediagram/ui`, `@liveplanner/ui`, …). Declared once at
 *  module scope, so it is the same object on every render, and typed with its package's initial-focus type
 *  (`AccountMenuKit<MenuInitialFocus>`). Methods, so such a kit fits wherever `AccountMenuKit` is asked for. */
export interface AccountMenuKit<Focus = unknown> {
  useMenuButton(): AccountMenuButton<Focus>;
  useMenu(options: {
    open: boolean;
    onClose: () => void;
    trigger: HTMLElement | null;
    initialFocus: Focus;
  }): {
    attach: (el: HTMLElement | null) => void;
    surfaceProps: HTMLAttributes<HTMLElement>;
  };
  useClickOutside(
    ref: RefObject<HTMLElement | null>,
    onOutside: () => void,
    enabled: boolean,
  ): void;
  icons: {
    chevron: IconComponent;
    tokens: IconComponent;
    settings: IconComponent;
  };
}

/** The account pages the menu leads to, as paths on liveworkspace.app. Teams are made and run in the Explorer
 *  (liveworkspace/docs/one-explorer.md "Teams are run in the Explorer"), so the menu has no Teams entry. */
export const ACCOUNT_PAGES = [
  { href: '/account/tokens', label: 'API tokens', hint: 'Connect tools and AI', icon: 'tokens' },
  {
    href: '/account/settings',
    label: 'Settings',
    hint: 'Profile, emails and privacy',
    icon: 'settings',
  },
] as const;

/** The signed-in person's menu. `pageHref` turns an account page's path into the link (in full on an app's own
 *  address); `onSignOut` ends the session, resolving false when it was refused (the menu stays open). */
export function AccountMenu({
  name,
  fullName,
  colour,
  kit,
  onSignOut,
  pageHref = (path) => path,
}: {
  name: string;
  // The full name, where the account has one beyond `name` (a given name): the avatar's initials come from it.
  fullName?: string | null;
  // The profile's presence colour, null for Automatic (the avatar's colour is then picked from the name).
  colour?: string | null;
  kit: AccountMenuKit;
  onSignOut: () => Promise<boolean>;
  pageHref?: (path: string) => string;
}) {
  const [leaving, setLeaving] = useState(false);
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    kit.useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = kit.useMenu({ open, onClose: close, trigger, initialFocus });
  kit.useClickOutside(ref, close, open);
  const { chevron: ChevronIcon } = kit.icons;

  async function leave() {
    setLeaving(true);
    const left = await onSignOut();
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
        <Avatar name={fullName || name} colour={colour} />
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
            <Avatar name={fullName || name} colour={colour} large />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your account</p>
            </div>
          </div>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          {ACCOUNT_PAGES.map(({ href, label, hint, icon }) => {
            const Icon = kit.icons[icon];
            return (
              <a key={href} href={pageHref(href)} role="menuitem" tabIndex={-1} className={item}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 dark:text-white">{label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                </span>
              </a>
            );
          })}
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

// The signed-in person's initials in a disc of their colour, as the apps draw people: their presence colour (or the
// one picked from the name) in a shade white reads on at AA (initials.ts avatarFill).
function Avatar({
  name,
  colour,
  large = false,
}: {
  name: string;
  colour?: string | null;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{ '--avatar': avatarFill(name, colour) } as CSSProperties}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--avatar)] font-semibold text-white ring-1 ring-black/5 ring-inset dark:ring-white/10 ${
        large ? 'size-10 text-sm' : 'size-7 text-[11px]'
      }`}
    >
      <span className="text-optical-centre">{initials(name)}</span>
    </span>
  );
}
