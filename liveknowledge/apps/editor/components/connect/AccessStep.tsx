'use client';

// Approve and Choose Access (docs/specs/030-knowledgebase/mcp-connect.md "The view" 3): what the app's sign-in page
// asks, then the three things a connection may do here, each with whether this person's connection gets it, and
// how writing is allowed. Presentation only: the api is the rule.
import type { ReactNode } from 'react';
import { Button } from '@liveknowledge/ui';
import {
  AllowWritingIcon,
  ReadsIcon,
  SuggestionIcon,
} from '@/components/insights/insights-icons';
import { INSIGHTS_MUTED } from '@/components/insights/InsightsSection';
import {
  accessRows,
  reachLine,
  writingLine,
  type AccessKey,
  type ConnectRole,
} from '@/lib/knowledge-connect/connect-words';

const ROW_ICON: Record<AccessKey, ReactNode> = {
  read: <ReadsIcon />,
  suggest: <SuggestionIcon />,
  write: <AllowWritingIcon />,
};

const CHIP = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium';
const GRANTED = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200';
const NOT_YET = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

export function AccessStep({
  role,
  name,
  onOpenAgents,
}: {
  role: ConnectRole;
  // The knowledgebase's name, as the app should be told it.
  name: string;
  onOpenAgents: () => void;
}) {
  const text = `text-[13px] leading-5 ${INSIGHTS_MUTED}`;
  return (
    <div className="flex flex-col gap-4" data-connect-access={role}>
      <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
        Your app opens a liveknowledge page titled{' '}
        <strong className="font-semibold">Connect</strong> and the app&apos;s name. Check the site
        it says the access is sent to, switch on{' '}
        <strong className="font-semibold">Read-only access</strong> if the app should only read, and
        choose <strong className="font-semibold">Connect</strong>. That makes an API token named for
        the app, which you can revoke in Settings, under API Tokens.
      </p>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {accessRows(role).map((row) => (
          <li
            key={row.key}
            data-connect-access-row={row.key}
            className="flex items-start gap-3 px-3.5 py-3"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 [&_svg]:size-4"
            >
              {ROW_ICON[row.key]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {row.title}
                </span>
                <span className={`${CHIP} ${row.granted ? GRANTED : NOT_YET}`}>
                  <span className="sr-only">Yours: </span>
                  {row.yours}
                </span>
              </div>
              <p className={`mt-0.5 ${text}`}>{row.about}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className={text} data-connect-writing="">
          {writingLine(role)}
        </p>
        {role === 'editor' ? (
          <Button
            variant="secondary"
            size="xs"
            onClick={onOpenAgents}
            className="w-fit shrink-0 cursor-pointer phone:min-h-11"
          >
            Open Connected Agents
          </Button>
        ) : null}
      </div>
      <p className={text}>{reachLine(name)}</p>
    </div>
  );
}
