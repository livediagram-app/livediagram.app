'use client';

// Header sign-in / sign-out pill. Shows:
//
//   - signed out → "Sign in" link to /live/sign-in/
//   - signed in  → initial-bubble + dropdown with "Sign out"
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
// spec/03 self-host path), the component is a no-op. Same module-load
// hook-swap pattern as `useClerkApiBootstrap` — calling `useAuth`
// outside a ClerkProvider would throw, so the disabled branch never
// touches Clerk.

import { useAuth, useClerk, useUser } from '@clerk/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { clerkEnabled } from '@/lib/clerk-config';

// Lazy-load the delete-account dialog. Almost every signed-in
// session NEVER opens it (it's the destructive option at the
// bottom of an account menu most users won't even look at), but
// the static import shipped the 192-line component (plus its
// Clerk reverification + useReverification dependency surface)
// in the eager AuthControls bundle on every page. Switching to
// next/dynamic + gating the JSX on `deleteOpen` means the chunk
// only fetches when the user actually clicks Delete account.
const DeleteAccountDialog = dynamic(() =>
  import('./DeleteAccountDialog').then((m) => m.DeleteAccountDialog),
);

function AuthControlsEnabled() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside to close. Bound only when the menu is open so
  // we're not running pointerdown listeners for an inert button.
  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [menuOpen]);

  if (!authLoaded) return null;

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in/"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <SignInIcon />
        Sign in
      </Link>
    );
  }

  const initial = (user?.firstName ?? user?.username ?? '?').slice(0, 1).toUpperCase();
  const displayName =
    user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? '';
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
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:py-1 sm:pl-1 sm:pr-3"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
          {initial}
        </span>
        {pillLabel ? <span className="hidden truncate sm:inline">{pillLabel}</span> : null}
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
        >
          {displayName ? (
            <div className="px-3 py-2 text-xs text-slate-500">
              <p className="truncate font-medium text-slate-900">{displayName}</p>
              {user?.primaryEmailAddress?.emailAddress &&
              user.primaryEmailAddress.emailAddress !== displayName ? (
                <p className="truncate">{user.primaryEmailAddress.emailAddress}</p>
              ) : null}
            </div>
          ) : null}
          <Link
            href="/explorer"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Explorer
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              // Land on the marketing landing page at `/` (router worker
              // serves marketing there). Same destination as the delete-
              // account flow — once you're signed out, the editor is
              // the wrong default, the landing page is.
              void signOut({ redirectUrl: '/' });
            }}
            className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
            className="block w-full rounded px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            Delete account
          </button>
        </div>
      ) : null}
      {deleteOpen ? (
        <DeleteAccountDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={async () => {
            // Backend + Clerk delete already completed inside the
            // dialog. Sign out (just to clear any client-side Clerk
            // state, the token's already invalid) and land the user
            // on the marketing site at `/` (router worker serves the
            // marketing app there). signOut's redirectUrl goes
            // through window.location, so the basePath '/live' is
            // NOT applied: '/' is the real root, not '/live/'.
            await signOut({ redirectUrl: '/' });
          }}
        />
      ) : null}
    </div>
  );
}

function AuthControlsDisabled() {
  // Clerk not configured — sign-in is not part of this deployment.
  // Render nothing so the header just shows the Share button.
  return null;
}

// Door-with-arrow glyph — same 13px / 1.6 stroke convention as the
// other header icons (ShareIcon in EditorHeader, etc.) so the
// Sign-in pill reads as a peer of those buttons.
function SignInIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3h3.5A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13H9" />
      <path d="M2 8h7" />
      <path d="M6 5l3 3-3 3" />
    </svg>
  );
}

export const AuthControls = clerkEnabled ? AuthControlsEnabled : AuthControlsDisabled;
