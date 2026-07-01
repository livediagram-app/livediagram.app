'use client';

// "Why sign in?" modal (spec/36) opened from the Explorer sign-in
// banner's Learn more button. Lists the concrete benefits a guest
// gains by creating an account, each with an icon + one-liner, and
// repeats the primary Sign in call to action in the footer.
//
// Keeps its own portal shell rather than the shared Dialog primitive
// because of the bespoke design (brand-gradient header, bottom-sheet on
// mobile, rounded-2xl, max-w-lg) that Dialog's centred fixed-width frame
// doesn't fit — but it shares the same focus-trap + Escape behaviour so
// keyboard / screen-reader users get the same modal semantics.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';

type Reason = {
  icon: ReactNode;
  title: string;
  body: string;
};

const REASONS: Reason[] = [
  {
    icon: <ShieldIcon />,
    title: 'Keep your diagrams safe',
    body: 'Guest diagrams are tied to this browser, so a cache clear (or a browser that wipes data on close) can lose access to them. Signing in attaches them to your account so they survive a cache clear or browser restart.',
  },
  {
    icon: <DevicesIcon />,
    title: 'Open them anywhere',
    body: 'Your work syncs to your account, so the same diagrams are waiting on your laptop, desktop, and phone.',
  },
  {
    icon: <TeamIcon />,
    title: 'Work as a team',
    body: 'Create teams, invite people by email, and share a team library everyone can open and manage.',
  },
  {
    icon: <PlugIcon />,
    title: 'Connect AI tools',
    body: 'Mint API tokens and connect external AI assistants over MCP, so tools like Claude can read and build your diagrams for you.',
  },
  {
    icon: <BadgeIcon />,
    title: 'Use your real name',
    body: 'Shared diagrams and live cursors show your name instead of a random guest id, so collaborators know who did what.',
  },
  {
    icon: <LinkIcon />,
    title: 'Your shares, organised',
    body: 'Manage every share link and its expiry from one account, instead of one browser at a time.',
  },
];

export function SignInReasonsModal({
  open,
  onClose,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  // Fired when the footer Sign in CTA is clicked (for telemetry); the
  // navigation itself is a real <Link> so it works without JS.
  onSignIn: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);
  // Return to the current page after sign-in (before the early return).
  const { signInHref } = useAuthHrefs();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center dark:bg-slate-950/60"
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-reasons-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg animate-fly-up-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header with a brand gradient wash so the modal reads as a
              celebratory upsell, not a system dialog. */}
          <div className="relative shrink-0 bg-gradient-to-br from-brand-500 to-brand-600 px-6 pb-5 pt-6 text-white">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
              <SparkleIcon />
              Free account
            </div>
            <h2 id="signin-reasons-title" className="mt-1.5 text-xl font-bold">
              Why sign in?
            </h2>
            <p className="mt-1 text-sm text-white/85">
              livediagram always works without an account, but a free one unlocks a lot.
            </p>
          </div>

          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3 sm:px-4">
            {REASONS.map((r) => (
              <li
                key={r.title}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {r.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-slate-500 dark:text-slate-400">
                    {r.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 flex-col-reverse items-center gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <div className="sm:mr-auto">
              <HelpArticleLink
                article="guestVsAccount"
                variant="text"
                title="Guest vs account"
                description="What changes when you sign in, and what stays the same."
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:w-auto dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Maybe later
            </button>
            <Link
              href={signInHref}
              onClick={onSignIn}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 sm:w-auto"
            >
              <SignInIcon />
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// --- Icons. Inline so the modal reads as one cohesive set (18px,
// 1.6 stroke), independent of the explorer's smaller row glyphs. ---

function ShieldIcon() {
  return (
    <Svg>
      <path d="M9 1.5 3 4v5c0 3.5 2.5 5.6 6 6.5 3.5-.9 6-3 6-6.5V4L9 1.5Z" />
      <path d="M6.5 9 8.2 10.7 11.5 7.2" />
    </Svg>
  );
}

function DevicesIcon() {
  return (
    <Svg>
      <rect x="1.5" y="3" width="11" height="8" rx="1" />
      <path d="M1.5 13.5h7" />
      <rect x="12" y="7" width="4.5" height="9" rx="1" />
    </Svg>
  );
}

function TeamIcon() {
  return (
    <Svg>
      <circle cx="6.5" cy="6" r="2.4" />
      <path d="M2.5 14.5c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" />
      <path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.2" />
      <path d="M12.5 10.9c1.8.2 3 1.5 3 3.6" />
    </Svg>
  );
}

function BadgeIcon() {
  return (
    <Svg>
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" />
      <circle cx="9" cy="7" r="2" />
      <path d="M5.5 13c.6-1.7 2-2.5 3.5-2.5s2.9.8 3.5 2.5" />
    </Svg>
  );
}

function LinkIcon() {
  return (
    <Svg>
      <path d="M7.5 10.5 10.5 7.5" />
      <path d="M8.5 5.5 10 4a2.8 2.8 0 0 1 4 4l-1.5 1.5" />
      <path d="M9.5 12.5 8 14a2.8 2.8 0 0 1-4-4l1.5-1.5" />
    </Svg>
  );
}

function PlugIcon() {
  return (
    <Svg>
      <path d="M6 2v3M12 2v3" />
      <path d="M4.5 5h9v2.5a4.5 4.5 0 0 1-9 0V5Z" />
      <path d="M9 12v4" />
    </Svg>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="opacity-90"
    >
      <path d="M8 1.5 9.2 5.4 13 6.6 9.2 7.8 8 11.7 6.8 7.8 3 6.6 6.8 5.4 8 1.5Z" />
      <path d="M13 10.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg
      width="14"
      height="14"
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
