'use client';

// The header's account control, one copy for every editor (docs/specs/007-editor/editor-app.md "Header actions";
// `live-app.md` in livedesign):
//
//   - signed out → a "Sign in" action that returns here after sign-in
//   - signed in  → the account's picture (over its two initials, as liveworkspace.app's) and first name, opening a menu with Account and Sign Out
//
// It reads the deferred auth context the AuthProvider supplies, so it works anywhere under the provider. While the
// session is still loading (first paint, before the token request answers) it renders nothing, so the header doesn't
// flash "Sign in" only to swap it for the account a tick later.
//
// Each editor passes only what is its own: where Account goes (`onOpenAccount`) and, for livedocuments and livedesign,
// the picture from their own-picture store (`picture`). Sign Out is tracked through the workbench's `track` binding.

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Glyph, PictureDisc, useClickOutside, useMenu, useMenuButton } from '@liveworkspace/ui';
import { cutText } from '@liveworkspace/model-core/text-cut';
import { onProfileSaved } from '@liveworkspace/settings-ui/profile-events';
import { workbench } from '../../bindings';
import { accountAvatarFill, accountInitials, type SavedLook } from '../../lib/account-avatar';
import { useDeferredAuth } from '../providers/deferred-auth';
import { useAuthHrefs } from './auth-routes';
import {
  HEADER_ACTION_BTN,
  HEADER_ACTION_TONE,
  HEADER_ICON_SLOT_PX,
  HeaderGlyph,
} from './header-action';

/** The pill's first name, cut so a very long one doesn't push the label off the action. */
export const PILL_NAME_MAX = 16;

export type AuthControlsProps = {
  // Opens this page's Settings dialog on its Account category, in place. Without one, the item falls back to the
  // Explorer's `?settings=account` deep link.
  onOpenAccount?: () => void;
  // The picture your own chrome shows you, whatever Show My Google Picture says (an editor with an own-picture store
  // passes it). Left out, the session's `user.picture`.
  picture?: string | null;
};

const MENU_ITEM =
  'block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700';

export function AuthControls({ onOpenAccount, picture }: AuthControlsProps) {
  const { authLoaded, isSignedIn, user, signOut } = useDeferredAuth();
  // A menu button (docs/specs/004-interface-design/menus.md): the menu keyboard comes from the hooks.
  const {
    open: menuOpen,
    close: closeMenu,
    toggle,
    trigger,
    setTrigger,
    onTriggerKeyDown,
  } = useMenuButton();
  const menuRef = useRef<HTMLDivElement>(null);
  const nameId = useId();
  // Return here after sign-in (must run before the early returns below).
  const { signInHref } = useAuthHrefs();
  const savedLook = useSavedLook();

  // Click-outside closes the menu; the listener installs only while it is open.
  useClickOutside(menuRef, closeMenu, menuOpen);

  if (!authLoaded) return null;

  if (!isSignedIn) {
    return (
      <Link href={signInHref} className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}>
        <HeaderGlyph>
          <SignInIcon />
        </HeaderGlyph>
        Sign In
      </Link>
    );
  }

  const displayName = user?.fullName ?? user?.username ?? user?.email ?? '';
  // The pill shows the first name only (or the username): the picture and first name are the recognisable "this is
  // me", and the full name is in the menu.
  const rawName = user?.firstName ?? user?.username ?? '';
  const pillLabel = !rawName
    ? null
    : rawName.length > PILL_NAME_MAX
      ? `${cutText(rawName, PILL_NAME_MAX - 1)}…`
      : rawName;

  return (
    <div className="relative flex h-full" ref={menuRef}>
      <button
        ref={setTrigger}
        type="button"
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}
      >
        <HeaderGlyph>
          {/* The Google picture when there is one, always on your own screen (liveworkspace/docs/specs/003-accounts/accounts.md
              "Profile pictures"). */}
          <PictureDisc
            pictureUrl={picture === undefined ? user?.picture : picture}
            name={displayName}
            size={HEADER_ICON_SLOT_PX}
            aria-hidden
            // The account's own colour, or for Automatic the one picked from its name, in the deep shade the white
            // initials read on in both themes (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): the
            // same disc as liveworkspace.app's account menu, through the same custom property, and the colour of this
            // person's cursor and author dots.
            style={{ '--avatar': accountAvatarFill(user, savedLook) } as CSSProperties}
            className="bg-(--avatar) text-[10px] font-semibold text-white"
          >
            {accountInitials(user)}
          </PictureDisc>
        </HeaderGlyph>
        <span className="max-w-[4.5rem] truncate">{pillLabel ?? 'Account'}</span>
      </button>
      {menuOpen ? (
        <AccountMenu trigger={trigger} onClose={closeMenu}>
          {displayName ? (
            <div
              data-menu-label=""
              id={nameId}
              aria-hidden
              className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400"
            >
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {displayName}
              </p>
              {user?.email && user.email !== displayName ? (
                <p className="truncate">{user.email}</p>
              ) : null}
            </div>
          ) : null}
          {/* Account (docs/specs/007-editor/user-preferences.md): identity, email notifications and account deletion
              all live in the Settings dialog, so this opens it on its Account category, in place when the host can. */}
          {onOpenAccount ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                closeMenu();
                onOpenAccount();
              }}
              className={MENU_ITEM}
            >
              Account
            </button>
          ) : (
            <Link
              href="/explorer?settings=account"
              role="menuitem"
              tabIndex={-1}
              onClick={closeMenu}
              className={MENU_ITEM}
            >
              Account
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              workbench.track('Session', 'SignedOut', undefined);
              // Land on the marketing landing page at `/` (the router serves marketing there): once signed out, the
              // editor is the wrong default.
              void signOut({ redirectUrl: '/' });
            }}
            className={MENU_ITEM}
          >
            Sign Out
          </button>
        </AccountMenu>
      ) : null}
    </div>
  );
}

// A profile saved in Settings › Profile on this page (an editor's or the Explorer's), so the disc takes a new colour
// or name at once; until then, null, and the session's colour stands (it catches up at the next token refresh).
export function useSavedLook(): SavedLook | null {
  const [saved, setSaved] = useState<SavedLook | null>(null);
  useEffect(() => onProfileSaved((p) => setSaved({ name: p.name, colour: p.color })), []);
  return saved;
}

function AccountMenu({
  trigger,
  onClose,
  children,
}: {
  trigger: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute right-0 top-full mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
    >
      {children}
    </div>
  );
}

// Door-with-arrow glyph, the same 13px / 1.6 stroke as the other header icons, so the Sign in action reads as a peer
// of them. Exported so every sign-in affordance can wear it and read as one action.
export function SignInIcon({ size = 13 }: { size?: number } = {}) {
  return (
    <Glyph size={size} units={16}>
      <path d="M9 3h3.5A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13H9" />
      <path d="M2 8h7" />
      <path d="M6 5l3 3-3 3" />
    </Glyph>
  );
}
