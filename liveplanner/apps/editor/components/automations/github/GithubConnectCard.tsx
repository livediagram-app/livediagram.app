'use client';

// Connect GitHub (docs/specs/026-plan/automations.md "The GitHub view": Not connected): GitHub's mark, what connecting
// does, what it asks of GitHub, Connect GitHub and How It Works. The view draws it whole; a GitHub trigger's panel
// draws it compact, in place, so a rule being built can connect without leaving it (the rule is kept for the round
// trip). Connect GitHub stays busy until the page leaves for GitHub; a refusal says why under it.

import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { Button, CheckIcon, GithubMarkIcon } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { AutomationsScope } from '../automations-client';
import { GithubRefusal } from './github-client';
import { goConnectGithub } from './github-return';

export const GITHUB_CONNECT_LINE =
  'Link pull requests to cards: a card shows its pull request’s state, and rules run when one opens, merges, closes or its checks finish.';

const FACTS = [
  'Read-only: pull requests, checks and metadata.',
  'No personal GitHub token is kept.',
  'Pick which repositories this plan hears.',
];

/** GitHub's mark on its own dark disc (light in dark mode). */
export function GithubDiscMark({ size = 40 }: { size?: 32 | 40 | 48 }) {
  const box =
    size === 48 ? 'size-12 rounded-2xl' : size === 40 ? 'size-10 rounded-xl' : 'size-8 rounded-lg';
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center bg-[#1f2328] text-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.6)] dark:bg-slate-100 dark:text-[#1f2328] ${box}`}
    >
      <GithubMarkIcon size={size === 48 ? 24 : size === 40 ? 20 : 16} />
    </span>
  );
}

export function connectRefusalWords(
  error: unknown,
  act: 'connect' | 'disconnect' = 'connect',
): string {
  if (error instanceof GithubRefusal && error.code === 'github_needs_editor')
    return `Only an Editor signed in can ${act} GitHub.`;
  return 'GitHub didn’t answer. Check your connection and try again.';
}

export function GithubConnectCard({
  scope,
  draft,
  compact = false,
}: {
  scope: AutomationsScope;
  // The rule to come back to, as it stands at the press, when connecting from its trigger's panel.
  draft?: () => AutomationRuleBody | null;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // The page leaves for GitHub: the button stays busy until it has.
      await goConnectGithub(scope, draft?.() ?? null);
    } catch (e) {
      debugLog('[github] connect.failed', { error: String(e) });
      setError(connectRefusalWords(e));
      setBusy(false);
    }
  };
  const button = (
    <Button
      variant="primary"
      size={compact ? 'xs' : 'sm'}
      disabled={busy}
      onClick={() => void connect()}
    >
      <GithubMarkIcon size={compact ? 12 : 14} />
      {busy ? 'Opening GitHub…' : 'Connect GitHub'}
    </Button>
  );
  const refused = error ? (
    <p role="alert" className="text-[12px] font-medium text-red-700 dark:text-red-300">
      {error}
    </p>
  ) : null;
  if (compact)
    return (
      <div
        data-github-connect="compact"
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <GithubDiscMark size={32} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              Connect GitHub First
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
              This rule hears this plan’s linked pull requests once GitHub is connected. You come
              back here to finish it.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{button}</div>
        {refused}
      </div>
    );
  return (
    <div data-github-connect="" className="flex flex-col items-center px-2 py-4 text-center">
      <GithubDiscMark size={48} />
      <h3 className="mt-4 text-[17px] font-semibold text-slate-900 dark:text-slate-50">
        Connect GitHub
      </h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-5 text-slate-600 dark:text-slate-300">
        {GITHUB_CONNECT_LINE}
      </p>
      <ul className="mt-5 flex w-full max-w-sm flex-col gap-2 text-left">
        {FACTS.map((fact) => (
          <li
            key={fact}
            className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
          >
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            >
              <CheckIcon size={12} />
            </span>
            {fact}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {button}
        <HelpArticleLink article="planGithub" variant="button" label="How It Works" />
      </div>
      <div className="mt-3">{refused}</div>
    </div>
  );
}
