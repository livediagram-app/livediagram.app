'use client';

// The Automations screen's GitHub view (docs/specs/026-plan/automations.md "The GitHub view"), drawn where the builder
// is: a breadcrumb back to Automations, then the plan's connection. Not connected: Connect GitHub. Connected: the
// account and who connected it, the repositories the plan hears, Change on GitHub (a connect again, so GitHub's own
// page adds or removes repositories) and Disconnect, which asks in the app first. Coming back from GitHub, a line says
// how it went. The connection is read when the view opens, never on the board.

import { useState, type ReactNode } from 'react';
import {
  Button,
  CompactEmptyState,
  GithubMarkIcon,
  formatRelativeTimeShort,
} from '@liveplanner/ui';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import type { AutomationsScope } from '../automations-client';
import { disconnectGithub } from './github-client';
import { GithubConnectCard, GithubDiscMark, connectRefusalWords } from './GithubConnectCard';
import { GithubRepositories } from './GithubRepositories';
import { GITHUB_RESULT_WORDS, goConnectGithub, type GithubResult } from './github-return';
import { setGithub, useGithubConnection } from './use-github-connection';

const RESULT_TONES: Readonly<Record<GithubResult, string>> = {
  connected:
    'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30',
  failed:
    'bg-red-50 text-red-900 ring-red-200 dark:bg-red-500/10 dark:text-red-100 dark:ring-red-500/30',
  requested:
    'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/30',
};

export const DISCONNECT_WORDS =
  'Cards stop showing pull request states, and GitHub rules stop running until you connect again. Your rules and fields stay.';

function Bar({
  onBack,
  phone,
  trailing,
}: {
  onBack: () => void;
  phone: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 ${phone ? 'px-4 py-3' : 'px-5 py-3.5'}`}
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px]">
        <button
          type="button"
          onClick={onBack}
          className="touch-target-y relative shrink-0 cursor-pointer rounded font-medium text-slate-500 transition hover:text-slate-900 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-white"
        >
          Automations
        </button>
        <span aria-hidden className="text-slate-400">
          /
        </span>
        <span
          aria-current="page"
          className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-50"
        >
          <GithubMarkIcon size={14} aria-hidden />
          GitHub
        </span>
      </nav>
      {trailing}
    </div>
  );
}

export function GithubView({
  scope,
  result,
  now,
  phone,
  onBack,
  trailing,
}: {
  scope: AutomationsScope;
  // How the round trip to GitHub went, when the view opened on coming back.
  result?: GithubResult;
  now: number;
  phone: boolean;
  onBack: () => void;
  // The dialog's close, at the bar's end.
  trailing?: ReactNode;
}) {
  const github = useGithubConnection(scope, true);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [shown, setShown] = useState<GithubResult | undefined>(result);

  const disconnect = async () => {
    setLeaving(true);
    try {
      await disconnectGithub(scope);
      setGithub(scope, null);
      track('Plan', 'Unlinked', 'Github');
      setShown(undefined);
      toast.info('Disconnected GitHub');
    } catch (e) {
      debugLog('[github] disconnect.failed', { error: String(e) });
      toast.error(connectRefusalWords(e));
    } finally {
      setLeaving(false);
      setConfirming(false);
    }
  };
  const changeOnGithub = async () => {
    setChanging(true);
    setChangeError(null);
    try {
      await goConnectGithub(scope, null);
    } catch (e) {
      debugLog('[github] change.failed', { error: String(e) });
      setChangeError(connectRefusalWords(e));
      setChanging(false);
    }
  };

  const body = (() => {
    if (github.status === 'refused')
      return (
        <CompactEmptyState
          role="status"
          icon={<GithubMarkIcon size={18} />}
          title="Only an Editor Signed In Can Connect GitHub"
          description="Ask whoever shared this plan for edit access, then sign in to connect it."
        />
      );
    if (github.status === 'error' && !github.connection)
      return (
        <CompactEmptyState
          role="status"
          icon={<GithubMarkIcon size={18} />}
          title="Couldn’t Load GitHub"
          description="Check your connection and try again."
          action={
            <Button variant="secondary" size="xs" onClick={github.reload}>
              Try Again
            </Button>
          }
        />
      );
    if (github.status !== 'ready' && !github.connection)
      return (
        <div role="status" aria-label="Loading GitHub" className="flex flex-col gap-3">
          {[0.7, 0.5, 0.6].map((o, i) => (
            <div
              key={i}
              style={{ opacity: o }}
              className="h-14 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
            />
          ))}
        </div>
      );
    const c = github.connection;
    if (!c) return <GithubConnectCard scope={scope} />;
    return (
      <div className="flex flex-col gap-6">
        <div
          data-github-account=""
          className={`flex gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${phone ? 'flex-col' : 'items-center'}`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <GithubDiscMark size={40} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                {c.account}
              </p>
              <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                Connected by {c.connectedBy.name} ·{' '}
                {formatRelativeTimeShort(Math.max(0, now - c.connectedAt))}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="xs"
            disabled={changing}
            onClick={() => void changeOnGithub()}
            className={phone ? 'w-full' : ''}
          >
            {changing ? 'Opening GitHub…' : 'Change on GitHub'}
          </Button>
        </div>
        {changeError ? (
          <p role="alert" className="-mt-4 text-[12px] font-medium text-red-700 dark:text-red-300">
            {changeError}
          </p>
        ) : null}
        <GithubRepositories key={c.connectedAt} scope={scope} connection={c} phone={phone} />
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Rules with a GitHub trigger live with the rest, under Rules. Disconnecting keeps them.
          </p>
          <div className={phone ? '' : 'flex justify-start'}>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setConfirming(true)}
              className={phone ? 'w-full' : ''}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div data-github-view="" className="flex min-h-0 flex-1 flex-col">
      <Bar onBack={onBack} phone={phone} trailing={trailing} />
      <div className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'px-4 py-5' : 'px-6 py-7'}`}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          {shown ? (
            <p
              role="status"
              data-github-result={shown}
              className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-5 ring-1 ${RESULT_TONES[shown]}`}
            >
              {GITHUB_RESULT_WORDS[shown]}
            </p>
          ) : null}
          {body}
        </div>
      </div>
      {confirming ? (
        <ConfirmDialog
          open
          title="Disconnect GitHub?"
          message={DISCONNECT_WORDS}
          confirmLabel={leaving ? 'Disconnecting…' : 'Disconnect'}
          cancelLabel="Cancel"
          onCancel={() => setConfirming(false)}
          onConfirm={() => void disconnect()}
        />
      ) : null}
    </div>
  );
}
