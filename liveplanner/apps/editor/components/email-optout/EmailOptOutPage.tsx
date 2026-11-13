'use client';

// A rule email's unsubscribe page (docs/specs/026-plan/automations.md "Typed-in addresses"): what unsubscribing does,
// and the one button that does it. The plan and the address's token come from the link's query (`p`, `t`); a link
// missing either says so. Done, a link the plan never made and a failed send are the page's other states.
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@liveplanner/ui';
import { sendEmailOptOut, type OptOutResult } from '@/lib/api/email-optout';

type State = 'loading' | 'ready' | 'sending' | OptOutResult;

const WORDS: Record<OptOutResult, [string, string]> = {
  done: [
    'You’re Unsubscribed',
    'This plan’s rules won’t email this address again. Other plans that email you have their own link.',
  ],
  not_found: [
    'This Link Doesn’t Work',
    'It may have been copied only in part. Open the link in the email again.',
  ],
  error: ['Something Went Wrong', 'You’re not unsubscribed yet. Try again in a moment.'],
};

// The link's query, read in the browser (null while the static page is built).
const noSubscribe = () => () => {};
const browserQuery = () => window.location.search;
const builtQuery = () => null;

export function EmailOptOutPage() {
  const query = useSyncExternalStore(noSubscribe, browserQuery, builtQuery);
  // Undefined while the query is unknown; null for a link missing the plan or the token.
  const link = useMemo(() => {
    if (query === null) return undefined;
    const params = new URLSearchParams(query);
    const plan = params.get('p');
    const token = params.get('t');
    return plan && token ? { plan, token } : null;
  }, [query]);
  const [sent, setSent] = useState<'sending' | OptOutResult | null>(null);
  const state: State =
    link === undefined ? 'loading' : link === null ? 'not_found' : (sent ?? 'ready');

  const unsubscribe = async () => {
    if (!link) return;
    setSent('sending');
    setSent(await sendEmailOptOut(link.plan, link.token));
  };

  const [title, body] =
    state === 'loading' || state === 'ready' || state === 'sending'
      ? [
          'Stop Emails From This Plan’s Rules',
          'An Editor of a liveplanner plan added your address to one of its rules. Unsubscribe and no rule in that plan emails you again.',
        ]
      : WORDS[state];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-lg shadow-slate-900/10 sm:px-8 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p
          aria-live="polite"
          className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        >
          {body}
        </p>
        {state === 'ready' || state === 'sending' || state === 'error' ? (
          <Button
            className="mt-6"
            busy={state === 'sending'}
            disabled={!link}
            onClick={() => void unsubscribe()}
          >
            {state === 'error' ? 'Try Again' : 'Unsubscribe'}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
