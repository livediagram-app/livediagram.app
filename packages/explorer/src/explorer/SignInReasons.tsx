'use client';

// Why sign in, from the guest's banner's Learn More: what an account adds, in the Explorer's words for the app's
// kind. Loaded only when first opened.

import { buttonClassName } from '@liveworkspace/ui';
import { Dialog } from '../ui/Dialog';
import { useExplorer } from './context';

export function SignInReasons({
  href,
  helpHref,
  onSignIn,
  onClose,
}: {
  href: string;
  helpHref?: string;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const { words } = useExplorer();
  const reasons = [
    {
      title: `Keep your ${words.lowerMany} safe`,
      body: `A guest's ${words.lowerMany} are tied to this browser, so clearing its data can lose them. Signing in keeps them with your account.`,
    },
    {
      title: 'Open them anywhere',
      body: `Your ${words.lowerMany} wait for you on your laptop, desktop and phone.`,
    },
    {
      title: 'Work as a team',
      body: 'Make teams, invite people by email, and share a library everyone can open, in every app.',
    },
    {
      title: 'Connect AI tools',
      body: 'Make API tokens and connect AI assistants over MCP, so they can read and build your work.',
    },
    {
      title: 'Use your real name',
      body: 'Shared work, cursors and comments show your name, so people know who did what.',
    },
  ];
  return (
    <Dialog onClose={onClose} ariaLabel="Why sign in" size="lg">
      <div className="bg-gradient-to-br from-brand-700 to-brand-800 px-6 pb-5 pt-6 text-white">
        <h2 className="text-xl font-bold">Sign in, free</h2>
        <p className="mt-1 text-sm text-white/90">Everything you made as a guest comes with you.</p>
      </div>
      <ul className="flex flex-col gap-1 px-4 py-3">
        {reasons.map((r) => (
          <li key={r.title} className="rounded-xl px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{r.title}</p>
            <p className="mt-0.5 text-sm leading-snug text-slate-500 dark:text-slate-400">
              {r.body}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col-reverse items-center gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
        {helpHref ? (
          <a
            href={helpHref}
            className="text-sm text-brand-700 underline-offset-2 hover:underline sm:mr-auto dark:text-brand-300"
          >
            Guests and accounts
          </a>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:w-auto dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Not Now
        </button>
        <a
          href={href}
          onClick={onSignIn}
          className={buttonClassName({ size: 'md', className: 'w-full sm:w-auto' })}
        >
          Sign In
        </a>
      </div>
    </Dialog>
  );
}
