'use client';

import { useSession } from '@/lib/session';

// The front door's account asks below the hero (liveworkspace/docs/specs/010-site/site.md "The front door"): the One
// account tile's link and the closing banner. Signed out, they ask for an account; signed in, nothing on the page
// asks the person to sign up, and each offers the way on instead. Until the page knows, the signed-out words show,
// right for most visitors. Both states have the same lines and buttons, so the swap moves nothing below them.

export const SIGN_UP_HREF = '/sign-up?return=%2F';
export const EXPLORER_HREF = '/explorer';

const signedIn = (state: string) => state === 'in';

/** The One account tile's link: Create your account, or Open your Explorer. */
export function AccountTileLink() {
  const session = useSession();
  const inside = signedIn(session.state);
  return (
    <a
      href={inside ? EXPLORER_HREF : SIGN_UP_HREF}
      data-account-tile-link=""
      className="relative touch-target-y mt-4 inline-flex w-fit items-center gap-1 font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
    >
      {inside ? 'Open your Explorer' : 'Create your account'} <span aria-hidden>→</span>
    </a>
  );
}

/** The hero's second promise: "No sign-up needed" says nothing to someone signed in, so they read that it's free. */
export function SignUpPromise() {
  const session = useSession();
  return <>{signedIn(session.state) ? 'Free to start' : 'No sign-up needed'}</>;
}

const PRIMARY =
  'relative touch-target-y inline-flex min-h-12 items-center rounded-full forced-edge bg-white px-6 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-px hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const SECONDARY =
  'relative touch-target-y inline-flex min-h-12 items-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/** The closing banner's line and buttons, under its heading. */
export function ClosingActions() {
  const session = useSession();
  const inside = signedIn(session.state);
  return (
    <div data-closing-actions={inside ? 'signed-in' : 'signed-out'}>
      <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
        {inside
          ? 'You’re signed in to every app. Pick up where you left off.'
          : 'Or start your work as a guest without signing in at all.'}
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <a href={inside ? EXPLORER_HREF : SIGN_UP_HREF} className={PRIMARY}>
          {inside ? 'Open Explorer' : 'Create Your Free Account'}
        </a>
        <a href="#apps" className={SECONDARY}>
          Pick an App
        </a>
      </div>
    </div>
  );
}
