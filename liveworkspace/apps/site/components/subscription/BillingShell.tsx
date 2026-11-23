import type { ReactNode } from 'react';
import { lucideWrench } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Spinner } from '@liveworkspace/ui';
import { Wordmark } from '../Wordmark';

const TestIcon = lucideGlyph(lucideWrench, 14);

/** The words every mock billing page says, so nobody takes it for a real charge. */
export const TEST_MODE = 'Test Mode: No Card Is Charged';

/**
 * The frame of the mock checkout and the mock billing portal (subscription.md "Billing": both say Test Mode): a quiet
 * page of its own, as a hosted checkout is, with the logo, the Test Mode band across the top, and the page's card
 * centred under it. No site navigation: the only ways out are the page's own.
 */
export function BillingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <p
        role="note"
        data-test-mode=""
        className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950"
      >
        <TestIcon aria-hidden />
        {TEST_MODE}
      </p>
      <header className="mx-auto flex w-full max-w-4xl items-center px-4 pt-6 sm:px-6 sm:pt-8">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        {children}
      </main>
    </div>
  );
}

/** The card a billing page stands on. */
export function BillingCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}

/** While the session is being read. */
export function BillingLoading({ label }: { label: string }) {
  return (
    <BillingCard>
      <div
        role="status"
        className="flex min-h-72 items-center justify-center gap-2.5 text-sm text-slate-600 dark:text-slate-300"
      >
        <Spinner size={16} />
        {label}
      </div>
    </BillingCard>
  );
}

/** A session that cannot be shown: its heading, why, and the way on. */
export function BillingMessage({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <BillingCard>
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </BillingCard>
  );
}
