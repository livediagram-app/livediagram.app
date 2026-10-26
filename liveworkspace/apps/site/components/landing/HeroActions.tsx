'use client';

import { useSession } from '@/lib/session';

const PRIMARY =
  'relative touch-target-y inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-white dark:text-slate-900 dark:shadow-black/30 dark:hover:bg-slate-100 dark:focus-visible:outline-white';
const SECONDARY =
  'relative touch-target-y inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-6 text-sm font-semibold text-slate-800 backdrop-blur transition hover:border-slate-400 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus-visible:outline-white';

// The hero's calls to action (liveworkspace/docs/specs/010-site/site.md "The front door"). Signed out: make the one
// account, or look at the apps first. Signed in, there is nothing to ask, so it shows nothing. Until
// the page knows, it shows the signed-out pair, which is right for most visitors.
export function HeroActions() {
  const session = useSession();

  if (session.state === 'in') return null;

  return (
    <div className="mt-9 flex flex-wrap justify-center gap-3 sm:justify-start">
      <a href="/sign-up?return=%2F" className={PRIMARY}>
        Create your free account
      </a>
      <a href="#apps" className={SECONDARY}>
        Explore the apps
      </a>
    </div>
  );
}
