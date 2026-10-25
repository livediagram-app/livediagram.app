'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { lucideChevronDown, lucideSettings } from '@liveworkspace/icons/lucide';
import { lucideGlyph, useClickOutside, useMenu, useMenuButton } from '@liveworkspace/ui';
import { ACCOUNT_TRIGGER_CLASS, GUEST_LABEL, GuestAvatar } from './face';
import { avatarFill, initials } from './initials';

// The account control (liveworkspace/docs/site.md "The header"). Signed in: the person's avatar (initials; accounts
// keep no pictures) and name, opening a menu of the Explorer (liveworkspace.app's header only), Settings and Sign
// out. Signed out: the same trigger as **Guest**, on a neutral avatar, opening Sign in (the primary), Create account
// and, where a guest has settings (the Explorer on an app's address), Settings. One component for liveworkspace.app's
// header, the Explorer on any address and every app's marketing header.
//
// Settings never leaves the address the person is on: where the surface has the Settings panel it opens it in place
// (`onOpenSettings`), and elsewhere (an app's marketing page) it links to the same address's Explorer with the panel
// open (`settingsHref`).
//
// The menu keeps the keyboard and focus behaviour every app's menus share (WAI-ARIA Menu Button, from
// @liveworkspace/ui) and the house icons.

type IconComponent = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;

const ChevronIcon = lucideGlyph(lucideChevronDown, 16);
const SettingsIcon = lucideGlyph(lucideSettings, 16);

/** Where Settings goes on a surface with no Settings panel of its own: the same address's Explorer, which opens the
 *  panel on load (liveworkspace/docs/site.md "Settings", Addresses). Teams are made and run in the Explorer too
 *  (liveworkspace/docs/one-explorer.md "Teams are run in the Explorer"), so the menu has no Teams entry. */
export const SETTINGS_HREF = '/explorer?settings=all';

/** Where a guest's menu leads: the surface's own Sign in and Create account, and Settings where a guest has some. */
export type GuestAccount = {
  signInHref: string;
  signUpHref: string;
  // Opens the guest's Settings (kept in this browser), where the surface has them.
  onOpenSettings?: () => void;
  // The pointer or focus reached Settings: its code can be fetched ahead of the press.
  onPrepareSettings?: () => void;
};

type Common = {
  // Opens the menu as it mounts: a press made on the Guest stand-in before this code arrived.
  openOnMount?: boolean;
  // Takes focus as it mounts: the stand-in it replaces had it.
  focusOnMount?: boolean;
};

type SignedIn = {
  name: string;
  // The full name, where the account has one beyond `name` (a given name): the avatar's initials come from it.
  fullName?: string | null;
  // The profile's presence colour, null for Automatic (the avatar's colour is then picked from the name).
  colour?: string | null;
  onSignOut: () => Promise<boolean>;
  // Opens the Settings panel in place, where the surface has one, and fetches its code ahead of the press.
  onOpenSettings?: () => void;
  onPrepareSettings?: () => void;
  // Where Settings goes without `onOpenSettings`: a path on the same address (`SETTINGS_HREF` when not given).
  settingsHref?: string;
  // The Explorer, on liveworkspace.app's own header (on an app's address the app's Explorer is a click away already).
  explorerHref?: string;
  guest?: undefined;
};

type Guest = { guest: GuestAccount };

/** The account control. Signed in: Settings opens the panel in place (`onOpenSettings`) or links to `settingsHref`,
 *  and `explorerHref` adds the Explorer; `onSignOut` ends the session, resolving false when it was refused (the menu stays open). As a guest
 *  (`guest`): Sign in, Create account and, where given, Settings. */
export function AccountMenu(props: Common & (SignedIn | Guest)) {
  const { openOnMount = false, focusOnMount = false } = props;
  const [leaving, setLeaving] = useState(false);
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({ open, onClose: close, trigger, initialFocus });
  useClickOutside(ref, close, open);

  // Arriving in place of the Guest stand-in: carry on where it left off, once.
  const triggerEl = useRef<HTMLButtonElement | null>(null);
  const attachTrigger = useCallback(
    (el: HTMLButtonElement | null) => {
      triggerEl.current = el;
      setTrigger(el);
    },
    [setTrigger],
  );
  const [arrival] = useState({ openOnMount, focusOnMount });
  useEffect(() => {
    if (arrival.openOnMount || arrival.focusOnMount) triggerEl.current?.focus();
    if (arrival.openOnMount) toggle();
  }, [arrival, toggle]);

  const guest = props.guest ?? null;
  const account: SignedIn | null = props.guest ? null : props;
  const label = account ? account.name : GUEST_LABEL;
  const avatar = (large: boolean) =>
    account ? (
      <Avatar name={account.fullName || account.name} colour={account.colour} large={large} />
    ) : (
      <GuestAvatar large={large} />
    );

  async function leave(onSignOut: () => Promise<boolean>) {
    setLeaving(true);
    const left = await onSignOut();
    setLeaving(false);
    if (left) close();
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={attachTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}, account menu`}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={`${ACCOUNT_TRIGGER_CLASS} ${open ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
      >
        {avatar(false)}
        <span className="truncate max-sm:hidden">{label}</span>
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
            {avatar(true)}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {guest ? 'Not signed in' : 'Your account'}
              </p>
            </div>
          </div>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          {!account ? (
            guest && <GuestItems guest={guest} settingsIcon={SettingsIcon} close={close} />
          ) : (
            <>
              {account.explorerHref ? (
                <PageItem
                  href={account.explorerHref}
                  label="Explorer"
                  hint="Your work in every app"
                  icon={ExplorerIcon}
                />
              ) : null}
              {account.onOpenSettings ? (
                <SettingsItem
                  icon={SettingsIcon}
                  hint="Profile, emails, API tokens"
                  onOpen={account.onOpenSettings}
                  onPrepare={account.onPrepareSettings}
                  close={close}
                />
              ) : (
                <PageItem
                  href={account.settingsHref ?? SETTINGS_HREF}
                  label="Settings"
                  hint="Profile, emails, API tokens"
                  icon={SettingsIcon}
                />
              )}
              <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => void leave(account.onSignOut)}
                disabled={leaving}
                className={`${ITEM} cursor-pointer`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <SignOutIcon />
                </span>
                {leaving ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ITEM =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:focus-visible:bg-slate-700/60';

// An item's name over its hint, its icon in a soft square.
function ItemBody({
  icon: Icon,
  label,
  hint,
}: {
  icon: IconComponent;
  label: string;
  hint: string;
}) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-slate-900 dark:text-white">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </>
  );
}

function PageItem({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: IconComponent;
}) {
  return (
    <a href={href} role="menuitem" tabIndex={-1} className={ITEM}>
      <ItemBody icon={icon} label={label} hint={hint} />
    </a>
  );
}

// A guest's menu: Sign in first and filled (what the menu is for), Create account, then Settings where given.
function GuestItems({
  guest,
  settingsIcon,
  close,
}: {
  guest: GuestAccount;
  settingsIcon: IconComponent;
  close: () => void;
}) {
  const { onOpenSettings, onPrepareSettings } = guest;
  return (
    <>
      <a
        href={guest.signInHref}
        role="menuitem"
        tabIndex={-1}
        data-account-sign-in=""
        className="m-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:outline-white"
      >
        <SignInIcon />
        Sign in
      </a>
      <PageItem
        href={guest.signUpHref}
        label="Create account"
        hint="Free, and one account for every app"
        icon={CreateAccountIcon}
      />
      {onOpenSettings ? (
        <SettingsItem
          icon={settingsIcon}
          hint="Kept in this browser"
          onOpen={onOpenSettings}
          onPrepare={onPrepareSettings}
          close={close}
        />
      ) : null}
    </>
  );
}

// Settings as a button opening the surface's panel in place: its code fetched as the pointer or focus arrives, and
// opened as the menu closes.
function SettingsItem({
  icon,
  hint,
  onOpen,
  onPrepare,
  close,
}: {
  icon: IconComponent;
  hint: string;
  onOpen: () => void;
  onPrepare?: () => void;
  close: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-haspopup="dialog"
      onClick={() => {
        close();
        onOpen();
      }}
      onPointerEnter={onPrepare}
      onFocus={onPrepare}
      className={`${ITEM} cursor-pointer`}
    >
      <ItemBody icon={icon} label="Settings" hint={hint} />
    </button>
  );
}

// Four tiles: the Explorer, every app's work in one place. The icon set has no such glyph.
function ExplorerIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

// An arrow entering a door: the sign-out glyph's mirror. The icon set has neither.
function SignInIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

// A person with a plus beside them.
function CreateAccountIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
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
