'use client';

// Check It Worked (docs/specs/030-knowledgebase/mcp-connect.md "The view" 4): the status of the checks
// (useConnectStatus) in a polite live region, so its flip to Connected is heard, then a first prompt to copy.
import { CodeSnippet } from '@liveworkspace/marketing-site/components/ai/CodeSnippet';
import { lucideCircleCheck, lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { INSIGHTS_MUTED } from '@/components/insights/InsightsSection';
import { firstPrompt } from '@/lib/knowledge-connect/connect-words';
import { CHECK_EVERY_MS, CHECK_FOR_MS } from '@/lib/knowledge-connect/connect-status';
import { lastSeenText, readsText } from '@/lib/knowledge-ask/overview-words';
import { track } from '@/lib/telemetry';
import type { ConnectStatus } from './useConnectStatus';

const ConnectedIcon = lucideGlyph(lucideCircleCheck, 18);
const CheckIcon = lucideGlyph(lucideRefreshCw, 14);

const EVERY_S = CHECK_EVERY_MS / 1000;
const FOR_MIN = CHECK_FOR_MS / 60_000;

// The mark and its words stay side by side; the button wraps under them where there is no room (a phone).
const PANEL = 'flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border px-3.5 py-3';

export function StatusStep({
  status,
  name,
  now,
  onCheckNow,
  onManage,
}: {
  status: ConnectStatus;
  // The knowledgebase's name, for the prompt.
  name: string;
  now: number;
  onCheckNow: () => void;
  onManage: () => void;
}) {
  const text = `text-[13px] leading-5 ${INSIGHTS_MUTED}`;
  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite" data-connect-status={status.kind}>
        {status.kind === 'connected' ? (
          <div
            className={`${PANEL} border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10`}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950"
            >
              <ConnectedIcon />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                Connected: {status.agent.name}
              </p>
              <p className={text}>
                {status.agent.lastSeenAt !== undefined
                  ? `${lastSeenText(status.agent.lastSeenAt, now)}, `
                  : ''}
                {readsText(status.agent.readsThisWeek)}.
              </p>
            </div>
            <Button
              variant="secondary"
              size="xs"
              onClick={onManage}
              className="w-fit shrink-0 cursor-pointer phone:min-h-11"
            >
              Manage in Insights
            </Button>
          </div>
        ) : status.kind === 'failed' ? (
          <Callout
            tone="error"
            size="md"
            title="Could Not Check"
            action={{ label: 'Try Again', onSelect: onCheckNow }}
          >
            Whether your app has connected could not be read. Check your connection.
          </Callout>
        ) : (
          <div
            className={`${PANEL} border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50`}
          >
            <span aria-hidden className="relative flex size-9 shrink-0 items-center justify-center">
              <span
                className={`absolute size-3 rounded-full ${status.kind === 'stopped' ? 'bg-slate-400' : 'bg-brand-500 motion-safe:animate-ping opacity-60'}`}
              />
              <span
                className={`relative size-3 rounded-full ${status.kind === 'stopped' ? 'bg-slate-400 dark:bg-slate-500' : 'bg-brand-600 dark:bg-brand-400'}`}
              />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {status.kind === 'loading'
                  ? 'Checking…'
                  : status.kind === 'stopped'
                    ? 'Stopped Checking'
                    : 'Waiting for Your App'}
              </p>
              <p className={text}>
                {status.kind === 'stopped'
                  ? `Nothing arrived in ${FOR_MIN} minutes. Ask your app the prompt below, then check again.`
                  : `Ask it the prompt below. It shows here once it reads a page. Checking every ${EVERY_S} seconds.`}
              </p>
            </div>
            {status.kind === 'loading' ? null : (
              <Button
                variant="secondary"
                size="xs"
                onClick={onCheckNow}
                className="w-fit shrink-0 cursor-pointer phone:min-h-11"
              >
                <CheckIcon />
                {status.kind === 'stopped' ? 'Check Again' : 'Check Now'}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          A First Prompt to Try
        </p>
        <CodeSnippet
          code={firstPrompt(name)}
          lang="text"
          label="Prompt"
          wrap
          onCopied={() => track('UI', 'Copied', 'ConnectPrompt')}
        />
      </div>
    </div>
  );
}
