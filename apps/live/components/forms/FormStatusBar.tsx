'use client';

// Under the form's heading in the builder (docs/specs/030-forms/forms.md "Hearing about responses"): the response
// count with how many are new to this reader (opening the tab responses go to), and the notices that say the form takes no responses
// (paused: its destination broke; suspended after reports; closed), and an Editor's Problems with this Form, which opens
// Share Form where they are listed.
import type { ReactNode } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideTriangleAlert } from '@livediagram/icons/lucide';
import { DESTINATION_PROBLEM_TEXT, type DestinationProblem } from '@livediagram/forms';
import type { FormLinkState } from '@/hooks/forms/useFormLink';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 14);

export function FormStatusBar({
  link,
  problem,
  overdue = false,
  full = false,
  canEdit,
  onFix,
  controls,
  onOpenResponses,
  destinationName,
  problems = 0,
  onProblems,
}: {
  link: FormLinkState;
  problem: DestinationProblem | null;
  // Switched on but past its Close On or at its Response Limit (formClosedBySettings): it reads Closed.
  overdue?: boolean;
  // The document holds as many cards as it can: responses are refused until some go.
  full?: boolean;
  canEdit: boolean;
  onFix: () => void;
  // At its end, an Editor's: Preview (or Back to Editing), the help link and the form's cog.
  controls?: ReactNode;
  // Opens the tab the responses go to (absent without one), named for its tooltip.
  onOpenResponses?: (() => void) | null;
  destinationName?: string | null;
  // How many problems the form has (FormProblems), and opening Share Form where they are listed: an Editor's.
  problems?: number;
  onProblems?: () => void;
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
            : live.open && !overdue
              ? pill('green', 'Accepting Responses')
              : pill('slate', 'Closed');
  const count = (
    <>
      <strong className="font-semibold text-slate-900 dark:text-slate-50">{responses}</strong>{' '}
      {responses === 1 ? 'response' : 'responses'}
      {data?.unseen ? (
        <span className="ml-1 font-semibold text-brand-700 dark:text-brand-300">
          · {data.unseen} new
        </span>
      ) : null}
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      <div
        data-form-status=""
        className="flex items-center gap-x-3 gap-y-2 rounded-xl border max-sm:flex-wrap border-slate-200 bg-white px-4 py-2.5 text-[13px] dark:border-slate-700/80 dark:bg-slate-900"
      >
        {state}
        {/* The count opens the board (or sheet) the responses go to. */}
        {onOpenResponses ? (
          <Tooltip label={destinationName ? `Open ${destinationName}` : 'Open the responses'}>
            <button
              type="button"
              onClick={onOpenResponses}
              className="shrink-0 cursor-pointer rounded text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
            >
              {count}
            </button>
          </Tooltip>
        ) : (
          <span className="shrink-0 text-slate-600 dark:text-slate-300">{count}</span>
        )}
        {canEdit && problems > 0 && onProblems ? (
          <Tooltip label="See what to fix in Share Form">
            <button
              aria-label="Problems with this Form"
              type="button"
              onClick={onProblems}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-500/10"
            >
              <WarningIcon aria-hidden />
              Problems<span className="max-sm:hidden"> with this Form</span>
            </button>
          </Tooltip>
        ) : null}
        <span className="ml-auto flex min-w-0 items-center gap-1">{controls}</span>
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
