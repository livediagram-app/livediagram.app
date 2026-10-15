'use client';

// Under the form's heading in the builder (docs/specs/030-forms/forms.md "Hearing about responses"): the response
// count with how many are new to this reader, View on Board, and the notices that say the form takes no responses
// (paused: its destination broke; suspended after reports; closed).
import type { ReactNode } from 'react';
import { DESTINATION_PROBLEM_TEXT, type DestinationProblem } from '@livediagram/forms';
import type { FormLinkState } from '@/hooks/forms/useFormLink';

export function FormStatusBar({
  link,
  problem,
  full = false,
  canEdit,
  boardName,
  onViewBoard,
  onFix,
  controls,
}: {
  link: FormLinkState;
  problem: DestinationProblem | null;
  // The document holds as many cards as it can: responses are refused until some go.
  full?: boolean;
  canEdit: boolean;
  boardName: string | null;
  onViewBoard: (() => void) | null;
  onFix: () => void;
  // At its end, an Editor's: the form's cog (and Preview on a phone, which has no menu box).
  controls?: ReactNode;
}) {
  const data = link.link;
  const live = data?.link ?? null;
  const responses = data?.responses ?? 0;
  const pill = (tone: 'green' | 'slate' | 'amber' | 'red', text: string) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        tone === 'green'
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
          : tone === 'amber'
            ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
            : tone === 'red'
              ? 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'red' ? 'bg-red-500' : 'bg-slate-400'}`}
      />
      {text}
    </span>
  );
  const state =
    link.status === 'offline'
      ? pill('slate', 'Draft')
      : data?.suspendedAt && !live
        ? pill('red', 'Suspended')
        : !live
          ? pill('slate', 'Not Published')
          : problem
            ? pill('amber', 'Paused')
            : live.open
              ? pill('green', 'Accepting Responses')
              : pill('slate', 'Closed');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] dark:border-slate-700/80 dark:bg-slate-900">
        {state}
        <span className="text-slate-600 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-slate-50">{responses}</strong>{' '}
          {responses === 1 ? 'response' : 'responses'}
          {data?.unseen ? (
            <span className="ml-1 font-semibold text-brand-700 dark:text-brand-300">
              · {data.unseen} new
            </span>
          ) : null}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {onViewBoard && boardName ? (
            <button
              type="button"
              onClick={onViewBoard}
              className="mr-1 cursor-pointer font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              View on {boardName} →
            </button>
          ) : null}
          {controls}
        </span>
      </div>
      {live && problem ? (
        <div
          role="status"
          className="rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
        >
          Responses are paused. {DESTINATION_PROBLEM_TEXT[problem]}{' '}
          {canEdit ? (
            <button
              type="button"
              onClick={onFix}
              className="cursor-pointer font-semibold underline underline-offset-2"
            >
              Choose Where Responses Go
            </button>
          ) : null}
        </div>
      ) : null}
      {live && full ? (
        <div
          role="status"
          className="rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
        >
          Responses are paused: this document holds as many cards as it can.
        </div>
      ) : null}
      {data?.suspendedAt && !live ? (
        <div
          role="status"
          className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-900 dark:bg-red-500/10 dark:text-red-100"
        >
          This form’s link was suspended after reports from respondents.
        </div>
      ) : null}
    </div>
  );
}
