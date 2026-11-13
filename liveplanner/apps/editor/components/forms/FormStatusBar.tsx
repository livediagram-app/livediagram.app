'use client';

// The form's palette (docs/specs/030-forms/forms.md "Hearing about responses"): on a desktop it sits where every
// other tab's palette does, centred in the top row at the menu box's height, drawn as the toolbar card (livehuddle's
// palette look: hairline card, 36 px controls, hairlines between groups); on a phone it heads the form's column. It
// holds the form's state, the response count with how many are new to this reader (opening the tab responses go to),
// an Editor's red Not Taking Responses while a published form takes none, and the controls (Preview, help, the cog).
// The notices that say the form takes no responses (paused: its destination broke; full; suspended after reports)
// stay at the head of the column. Problems with this Form is the bottom-right cluster's Problems
// (FormProblemsButton).
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from '@liveplanner/ui';
import { DESTINATION_PROBLEM_TEXT, type DestinationProblem } from '@liveplanner/forms';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import {
  STRIP_RAIL_SCROLL,
  TOOLBAR_CARD,
  TOOLBAR_DIVIDER,
} from '@/components/chrome/toolbar-surface';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { formNotTakingReason, type FormNotTakingFix } from './form-not-taking';
import { FormNotTakingWarning } from './FormNotTakingWarning';

export function FormStatusBar({
  link,
  problem,
  closedBy = null,
  full = false,
  canEdit,
  onFix,
  controls,
  onOpenResponses,
  destinationName,
  onNotTaking,
  top = null,
}: {
  link: FormLinkState;
  problem: DestinationProblem | null;
  // Switched on but past its Close On or at its Response Limit (closedBySettings): it reads Closed.
  closedBy?: 'closes_at' | 'limit' | null;
  // The project holds as many cards as it can: responses are refused until some go.
  full?: boolean;
  canEdit: boolean;
  onFix: () => void;
  // At its end, an Editor's: Preview (or Back to Editing), the help link and the form's cog.
  controls?: ReactNode;
  // Opens the tab the responses go to (absent without one), named for its tooltip.
  onOpenResponses?: (() => void) | null;
  destinationName?: string | null;
  // Opens where Not Taking Responses is fixed (Share Form, Responses Go To, Settings or the responses' tab).
  onNotTaking?: (fix: FormNotTakingFix) => void;
  // The canvas to draw the palette on, centred in its top row (a desktop); null heads the column with it (a phone).
  top?: HTMLElement | null;
}) {
  // Drawn at the toolbar's UI scale, 12 px down, as the menu box is (DashboardSettings).
  const scale = useUiScale('toolbar');
  const data = link.link;
  const overdue = !!closedBy;
  // Published but taking no responses: an Editor's red warning after the count.
  const notTaking = canEdit ? formNotTakingReason({ link: data, problem, closedBy, full }) : null;
  const live = data?.link ?? null;
  const responses = data?.responses ?? 0;
  const pill = (tone: 'green' | 'slate' | 'amber' | 'red', text: string) => (
    <span
      className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium ${
        tone === 'green'
          ? 'text-emerald-800 dark:text-emerald-200'
          : tone === 'amber'
            ? 'text-amber-800 dark:text-amber-200'
            : tone === 'red'
              ? 'text-red-800 dark:text-red-200'
              : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      <span aria-hidden className="relative flex h-2 w-2">
        {tone === 'green' ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        ) : null}
        <span
          className={`relative h-2 w-2 rounded-full ${tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'red' ? 'bg-red-500' : 'bg-slate-400'}`}
        />
      </span>
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
  const palette = (
    <div
      data-form-status=""
      role="toolbar"
      aria-label="Form"
      onPointerDown={(e) => e.stopPropagation()}
      style={
        top
          ? scale === 1
            ? undefined
            : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale) }
          : undefined
      }
      className={`${TOOLBAR_CARD} min-w-0 ${
        top
          ? 'pointer-events-auto absolute left-1/2 top-3 z-[var(--z-toolbar)] max-w-[calc(100%-26rem)] -translate-x-1/2'
          : // In the column (a phone): it stays at the top as the form scrolls under it, as a palette would.
            'sticky top-0 z-[2] w-full'
      }`}
    >
      {/* One row that swipes sideways when it can't fit (a phone), as the palette does. */}
      <div className={`flex flex-1 items-center gap-0.5 text-[13px] ${STRIP_RAIL_SCROLL}`}>
        {/* A published form taking none is one red state, Not Taking Responses, in place of Closed, Paused or
            Suspended: its tooltip says why, and a press opens where that is fixed. */}
        {notTaking ? (
          <FormNotTakingWarning
            reason={notTaking}
            onFix={!onNotTaking || (notTaking === 'full' && !onOpenResponses) ? null : onNotTaking}
          />
        ) : (
          state
        )}
        <span aria-hidden className={TOOLBAR_DIVIDER} />
        {/* The count opens the board (or sheet) the responses go to. */}
        {onOpenResponses ? (
          <Tooltip label={destinationName ? `Open ${destinationName}` : 'Open the responses'}>
            <button
              type="button"
              onClick={onOpenResponses}
              className="relative flex h-9 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-lg px-2.5 touch-target-y text-[13px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <span>{count}</span>
            </button>
          </Tooltip>
        ) : (
          <span className="flex h-9 shrink-0 items-center whitespace-nowrap px-2.5 text-[13px] text-slate-600 dark:text-slate-300">
            {/* One span, so the flex row keeps the space inside "0 responses". */}
            <span>{count}</span>
          </span>
        )}
        {controls ? (
          <>
            <span aria-hidden className={`${TOOLBAR_DIVIDER} ml-auto`} />
            <span className="flex shrink-0 items-center gap-0.5 [&>*]:h-9 [&_button]:h-9 [&_button]:min-w-9 [&_a]:h-9 [&_a]:px-2.5 [&_a]:text-[13px]">
              {controls}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {top ? createPortal(palette, top) : palette}
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
          Responses are paused: this plan holds as many cards as it can.
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
