'use client';

// Header sign-in / sign-out pill. Shows:
//
//   - signed out → "Sign in" link to /live/sign-in/
//   - signed in  → account avatar (profile picture or initial) + dropdown with "Profile" + "Sign out"
//
// Mounted in EditorHeader (and any future header chrome that wants
// auth controls). Pure presentational — Clerk's `useUser` / `useAuth`
// hooks read from the same context the ClerkProvider in
// app/layout.tsx supplies, so this works anywhere under the provider.
//
// While Clerk is still loading (first paint, before
// useAuth().isLoaded) we render nothing so the header doesn't flicker
// a "Sign in" link only to swap it for the user pill a tick later.
//
// When Clerk is disabled for the deployment (no publishable key set —
// docs/specs/002-project-scope/open-source-and-business-model.md self-host path), the component is a no-op. Same module-load
// hook-swap pattern as `useClerkApiBootstrap` — calling `useAuth`
// outside a ClerkProvider would throw, so the disabled branch never
// touches Clerk.

import { useDeferredAuth } from '@/components/providers/deferred-auth';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useClickOutside, SOLID_BRAND_DARK, Glyph } from '@livediagram/ui';
import { clerkEnabled } from '@/lib/clerk-config';
import { track } from '@/lib/telemetry';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { AccountAvatar } from '@/components/primitives/AccountAvatar';
import { accountInitial } from '@/lib/account-avatar';
import {
  HEADER_ACTION_BTN,
  HEADER_ICON_SLOT_PX,
  HeaderGlyph,
} from '@/components/chrome/header-action';

// Shared tone for the (non-Share) header actions — slate text, subtle hover.
const HEADER_ACTION_TONE =
  'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';

// Account self-deletion now lives on the Explorer profile page (docs/specs/014-identity/profile-and-email-notifications.md),
// reachable from the "Profile" item below, so the destructive action has one
// home rather than hanging off this dropdown too.

type AuthControlsProps = {
  // Opens this page's Settings dialog on its Account category. Both hosts
  // (the editor and the Explorer) own a Settings dialog, so the Account item
  // opens it in place rather than navigating away. Without one, the item
  // falls back to the Explorer's `?settings=account` deep link.
  onOpenAccount?: () => void;
};

function AuthControlsEnabled({ onOpenAccount }: AuthControlsProps) {
  const { authLoaded, isSignedIn, user, signOut } = useDeferredAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Return here after sign-in (must run before the early returns below).
  const { signInHref } = useAuthHrefs();

  // Click-outside closes the menu. Listener installs only while
  // the menu is open so an inert button doesn't pay for it.
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  if (!authLoaded) return null;

  if (!isSignedIn) {
    return (
      <Link href={signInHref} className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}>
        <HeaderGlyph>
          <SignInIcon />
        </HeaderGlyph>
        Sign in
      </Link>
    );
  }

  const displayName = user?.fullName ?? user?.username ?? user?.email ?? '';
  // Pill label: first name only (or the username fallback). Last
  // names get truncated in account UIs because most users don't
  // need the full identity on screen — the avatar dot + first name
  // is the recognisable "this is me" combo. Truncate at 16 chars
  // so a very long first name doesn't push the chevron off-pill.
  const pillLabel = (() => {
    const raw = user?.firstName ?? user?.username ?? '';
    if (!raw) return null;
    return raw.length > 16 ? `${raw.slice(0, 15)}…` : raw;
  })();

  return (
    <div className="relative flex h-full" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}
      >
        <HeaderGlyph>
          {/* The profile picture when there is one (docs/specs/014-identity/profile-picture.md). */}
          <AccountAvatar
            initial={accountInitial(user)}
            pictureUrl={user?.pictureUrl ?? null}
            size={HEADER_ICON_SLOT_PX}
            className={`bg-brand-500 text-[10px] font-semibold text-white ${SOLID_BRAND_DARK}`}
          />
        </HeaderGlyph>
        <span className="max-w-[4.5rem] truncate">{pillLabel ?? 'Account'}</span>
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          {displayName ? (
            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {displayName}
              </p>
              {user?.email && user.email !== displayName ? (
                <p className="truncate">{user.email}</p>
              ) : null}
            </div>
          ) : null}
          {/* Account (docs/specs/007-editor/user-preferences.md): identity, email notifications and account
              deletion all live in the Settings dialog, so this opens it on
              its Account category, in place when the host can. */}
          {onOpenAccount ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpenAccount();
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Account
            </button>
          ) : (
            <Link
              href="/explorer?settings=account"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Account
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              track('Session', 'SignedOut');
              // Land on the marketing landing page at `/` (router worker
              // serves marketing there). Once you're signed out, the editor
              // is the wrong default, the landing page is.
              void signOut({ redirectUrl: '/' });
            }}
            className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AuthControlsDisabled(_props: AuthControlsProps) {
  // Clerk not configured — sign-in is not part of this deployment.
  // Render nothing so the header just shows the Share button.
  return null;
}

// Door-with-arrow glyph — same 13px / 1.6 stroke convention as the
// other header icons (ShareIcon in EditorHeader, etc.) so the
// Sign-in pill reads as a peer of those buttons. Exported because the
// Explorer's "Sign in to use teams" sidebar link (docs/specs/013-workspace/teams.md) renders
// the same glyph so the two sign-in affordances read as one action.
export function SignInIcon({ size = 13 }: { size?: number } = {}) {
  return (
    <Glyph size={size} units={16}>
      <path d="M9 3h3.5A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13H9" />
      <path d="M2 8h7" />
      <path d="M6 5l3 3-3 3" />
    </Glyph>
  );
}

export const AuthControls = clerkEnabled ? AuthControlsEnabled : AuthControlsDisabled;
