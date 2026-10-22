import type { ReactNode } from 'react';
import { Header } from '../Header';

// The frame of the sign-in, registration and consent pages (liveworkspace/docs/site.md "Accounts"):
// the site's header over a dotted ground, and the card, beside what an account adds when there is
// a pitch. The look is livediagram's account pages ("Night Band"), in liveworkspace's slate.
export function AccountPage({ children, alone = false }: { children: ReactNode; alone?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 bg-[radial-gradient(var(--color-slate-300)_1px,transparent_1px)] bg-size-[24px_24px] dark:bg-slate-900 dark:bg-none">
      <Header />
      <main
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 lg:px-12 lg:py-10 ${
          alone
            ? 'items-center justify-center'
            : 'lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16'
        }`}
      >
        {children}
      </main>
    </div>
  );
}

// The card the forms sit in.
export function AccountCard({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div
      className={`w-full animate-[card-in_420ms_cubic-bezier(.34,1.56,.64,1)_70ms_both] rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-900/10 motion-reduce:animate-none sm:p-8 lg:col-start-2 lg:row-start-1 dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-black/40 ${
        narrow ? 'max-w-md' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function AccountHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-indigo-950 sm:text-[28px] dark:text-slate-100">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'notice'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
        tone === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      }`}
    >
      {children}
    </p>
  );
}

export const PRIMARY_BUTTON =
  'relative min-h-11 w-full cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:disabled:hover:bg-slate-100';

export const SECONDARY_BUTTON =
  'relative min-h-11 w-full cursor-pointer rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800';

export const QUIET_BUTTON =
  'relative touch-target-y cursor-pointer py-1 text-sm text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100';

export const FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-3 focus:ring-slate-200 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-400/30';

export const LABEL = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';
