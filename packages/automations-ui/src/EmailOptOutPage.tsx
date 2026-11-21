'use client';

// A rule email's unsubscribe page, the same in every app (liveworkspace/docs/specs/018-automations/automations.md
// "Send Email"): what unsubscribing does, and the one button that does it. The item and the address's token come
// from the link's query (`param`, `t`); a link missing either says so. Done, a link the item never made and a failed
// send are the page's other states. Opening the page sends nothing, so a mail scanner that follows links
// unsubscribes nobody. Imports nothing of the screen: the app's page route renders it alone.
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@liveworkspace/ui';
import type { OptOutResult } from './email-optout';

type State = 'loading' | 'ready' | 'sending' | OptOutResult;

// The link's query, read in the browser (null while the static page is built).
const noSubscribe = () => () => {};
const browserQuery = () => window.location.search;
const builtQuery = () => null;

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function EmailOptOutPage({
  app,
  item,
  param,
  send,
}: {
  // The app's name as people see it: "liveplanner", "livediagram".
  app: string;
  // Its item's word as people see it, lower case: "plan", "canvas".
  item: string;
  // The query key the email's link names the item by ("p", "d").
  param: string;
  // The app's api call (sendEmailOptOut over its own api address).
  send: (itemId: string, token: string) => Promise<OptOutResult>;
}) {
  const query = useSyncExternalStore(noSubscribe, browserQuery, builtQuery);
  // Undefined while the query is unknown; null for a link missing the item or the token.
  const link = useMemo(() => {
    if (query === null) return undefined;
    const params = new URLSearchParams(query);
    const itemId = params.get(param);
    const token = params.get('t');
    return itemId && token ? { itemId, token } : null;
  }, [query, param]);
  const [sent, setSent] = useState<'sending' | OptOutResult | null>(null);
  const state: State =
    link === undefined ? 'loading' : link === null ? 'not_found' : (sent ?? 'ready');

  const unsubscribe = async () => {
    if (!link) return;
    setSent('sending');
    setSent(await send(link.itemId, link.token));
  };

  const words: Record<OptOutResult, [string, string]> = {
    done: [
      'You’re Unsubscribed',
      `This ${item}’s rules won’t email this address again. Other ${item}s that email you have their own link.`,
    ],
    not_found: [
      'This Link Doesn’t Work',
      'It may have been copied only in part. Open the link in the email again.',
    ],
    error: ['Something Went Wrong', 'You’re not unsubscribed yet. Try again in a moment.'],
  };
  const [title, body] =
    state === 'loading' || state === 'ready' || state === 'sending'
      ? [
          `Stop Emails From This ${capital(item)}’s Rules`,
          `An Editor of a ${app} ${item} added your address to one of its rules. Unsubscribe and no rule in that ${item} emails you again.`,
        ]
      : words[state];

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
