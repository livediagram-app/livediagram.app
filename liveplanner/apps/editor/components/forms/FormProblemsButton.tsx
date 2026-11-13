'use client';

// Problems in the bottom-right cluster, left of Style (docs/specs/030-forms/forms.md "Publishing and the form link"):
// shown only while the open Form tab has something standing between it and its responses (lib/form-problems-store.ts).
// Its popover lists them, each a row of its own saying what is wrong, in full; a press anywhere on the row takes you
// to it (the question or section, or Responses Go To), and a form-level one with nowhere to go is plain text. What blocks responses
// leads, in amber; a warning that holds nothing back follows, in slate. It closes itself once the last one is fixed.
import { useState } from 'react';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideChevronRight,
  lucideCircleAlert,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import {
  DESTINATION_PROBLEM_TEXT,
  publishProblemText,
  type PublishProblem,
} from '@liveplanner/forms';
import { ClusterPopoverButton } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { useFormProblemsHost } from '@/lib/form-problems-store';
import { formProblemCount } from './FormProblems';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 16);
const RowWarningIcon = lucideGlyph(lucideTriangleAlert, 14);
const RowNoteIcon = lucideGlyph(lucideCircleAlert, 14);
const ChevronIcon = lucideGlyph(lucideChevronRight, 14);

type Row = {
  key: string;
  text: string;
  blocks: boolean;
  fix: { label: string; run: () => void } | null;
};

export function FormProblemsButton() {
  const host = useFormProblemsHost();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const count = host ? formProblemCount(host.problem, host.notReady, host.warnings) : 0;
  // The last problem fixed (or the form closed) while it was open: it closes, and opens afresh next time. Adjusted
  // while rendering (React's "storing information from previous renders"), not in an effect.
  if (count === 0 && anchor) setAnchor(null);
  if (!host || count === 0) return null;
  const close = () => setAnchor(null);
  const fix = (run: () => void) => () => {
    close();
    run();
  };
  const destinationFix = { label: 'Choose Where Responses Go', run: fix(host.onFixDestination) };
  const rows: Row[] = [
    ...(host.problem
      ? [
          {
            key: 'destination',
            text:
              host.problem === 'no_destination'
                ? 'Responses have nowhere to go yet: choose a board or a sheet.'
                : DESTINATION_PROBLEM_TEXT[host.problem],
            blocks: true,
            fix: destinationFix,
          },
        ]
      : []),
    ...host.notReady.map((p: PublishProblem, i) => ({
      key: `ready-${i}`,
      text: publishProblemText(p),
      blocks: true,
      // A card type rule's is fixed where rules are set (Responses Go To); a question's or a section's has something to
      // point at; a form-level one has nothing to show.
      fix:
        'ruleId' in p && p.ruleId
          ? destinationFix
          : 'questionId' in p || 'sectionId' in p
            ? { label: 'Show', run: fix(() => host.onShow(p)) }
            : null,
    })),
    ...host.warnings.map((w, i) => ({
      key: `warning-${i}`,
      text: w,
      blocks: false,
      fix: destinationFix,
    })),
  ];
  const blocking = rows.filter((r) => r.blocks).length;
  return (
    <>
      <ClusterPopoverButton
        label={`Problems with this Form: ${count}`}
        name="Problems"
        hoverTitle="Problems"
        hoverDescription="What stops this form taking responses, and how to fix each."
        icon={
          <span className="text-amber-600 dark:text-amber-400">
            <WarningIcon aria-hidden />
          </span>
        }
        badge={
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold tabular-nums leading-none text-white">
            <span className="text-optical-centre">{count > 99 ? '99+' : count}</span>
          </span>
        }
        popoverOpen={!!anchor}
        onTogglePopover={(button) => setAnchor((a) => (a ? null : button))}
      />
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Problems with this Form"
          width={340}
          onClose={close}
          initialFocus="panel"
          pointer
        >
          <div className="sticky top-0 z-[1] border-b border-slate-100 bg-white px-4 pb-2.5 pt-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              Problems with this Form
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              {blocking
                ? `Fix ${blocking === 1 ? 'this' : `these ${blocking}`} before the form can take responses.`
                : 'Nothing stops responses, but worth a look.'}
            </p>
          </div>
          <ul className="flex flex-col py-1">
            {rows.map((r) => {
              const face = (
                <>
                  <span
                    aria-hidden
                    className={`mt-0.5 flex shrink-0 ${r.blocks ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-400'}`}
                  >
                    {r.blocks ? <RowWarningIcon /> : <RowNoteIcon />}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
                    {r.text}
                  </span>
                </>
              );
              return (
                <li
                  key={r.key}
                  className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                >
                  {/* The whole row takes you to it: the question or section, or Responses Go To. A form-level one
                      (no questions yet) has nowhere to go, so it is plain text. */}
                  {r.fix ? (
                    <button
                      type="button"
                      onClick={r.fix.run}
                      aria-label={`${r.text} ${r.fix.label}`}
                      className="group/row flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
                    >
                      {face}
                      <span
                        aria-hidden
                        className="mt-0.5 flex shrink-0 text-slate-300 transition group-hover/row:translate-x-0.5 group-hover/row:text-slate-500 motion-reduce:transition-none dark:text-slate-600 dark:group-hover/row:text-slate-300"
                      >
                        <ChevronIcon />
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-start gap-2.5 px-4 py-2.5">{face}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
