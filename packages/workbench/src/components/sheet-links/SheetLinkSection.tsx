'use client';

// The chart menu's Data section while a chart is, or could be, linked to a liveplanner sheet (each reader app's
// docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"). Linked: the Sheet row (the plan, the
// sheet and range, how fresh the values are) with Update, Change and Unlink for an Editor, in place of the data rows.
// Not linked: the rows, and an Editor's Link to Sheet under them. Opening the dialog closes the menu (`onClose`), as
// every other menu item that opens a dialog does: left open, its flyout sat over the dialog, and on a phone its sheet
// covered the dialog's Link button.
import type { ReactNode } from 'react';
import { CheckIcon, RefreshIcon, SheetLinkIcon } from '@liveworkspace/ui';
import { useRelativeNow } from '../../lib/relative-now';
import { useSheetLinks } from './SheetLinkedCharts';
import { sheetLinkLine, type SheetChart } from './sheet-links';

const ACTION =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none disabled:cursor-default disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const TONE = {
  live: 'text-emerald-700 dark:text-emerald-300',
  quiet: 'text-slate-500 dark:text-slate-400',
  warn: 'text-amber-700 dark:text-amber-300',
} as const;

// The Data section's body for a chart: the sheet link when there is one, else the data rows (`rows`) with an Editor's
// Link to Sheet under them.
export function SheetLinkSection({
  chart,
  rows,
  onClose,
}: {
  chart: SheetChart;
  rows: ReactNode;
  onClose: () => void;
}) {
  const links = useSheetLinks();
  const now = useRelativeNow();
  const source = chart.chartSheetSource;
  if (!links) return <>{rows}</>;
  const openLink = () => {
    links.openLink(chart.id);
    onClose();
  };
  if (!source && chart.chartSheetPending === true) {
    // Not linked yet (pie-chart.md "Not linked yet"): say the numbers are samples, then the rows; an Editor links a
    // sheet or keeps the numbers as the chart's own.
    return (
      <>
        <div className="flex flex-col gap-2 px-2 py-1.5" data-sheet-pending-section>
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/50">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              <SheetLinkIcon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Not linked to a sheet yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sample numbers, meant to come from a sheet.
              </p>
            </div>
          </div>
          {links.canEdit ? (
            <div className="-mx-1.5 flex flex-wrap items-center gap-1">
              <button type="button" className={ACTION} onClick={openLink}>
                <SheetLinkIcon size={13} />
                Link to Sheet…
              </button>
              <button type="button" className={ACTION} onClick={() => links.keepNumbers(chart.id)}>
                <CheckIcon size={13} />
                Use These Numbers
              </button>
            </div>
          ) : null}
        </div>
        {rows}
      </>
    );
  }
  if (!source) {
    return (
      <>
        {rows}
        {links.canEdit ? (
          <div className="px-2 pb-1.5">
            <button
              type="button"
              onClick={openLink}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
            >
              <SheetLinkIcon size={14} className="shrink-0" />
              Link to Sheet…
            </button>
          </div>
        ) : null}
      </>
    );
  }
  const status = links.statusOf(source);
  const line = sheetLinkLine(source, status, now);
  return (
    <div className="flex flex-col gap-2 px-2 py-1.5" data-sheet-link-section>
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
          <SheetLinkIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
            {line.name}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {source.sheetName || 'Sheet'} · <span className="font-mono">{source.a1}</span>
          </p>
          <p className={`mt-0.5 text-[11px] ${TONE[line.tone]}`}>
            {status.kind === 'reading' ? 'Reading the sheet…' : capitalise(line.detail)}
          </p>
        </div>
      </div>
      {links.canEdit ? (
        <div className="-mx-1.5 flex flex-wrap items-center gap-1">
          {/* No Update for an Editor who cannot open the plan, or once the range is gone (Work Tracker 1212): a read
              would only be refused again. Change… picks a range anew. */}
          {status.kind === 'saved' || status.kind === 'gone' ? null : (
            <button
              type="button"
              className={ACTION}
              disabled={status.kind === 'reading'}
              onClick={() => links.update(source)}
            >
              <RefreshIcon size={13} />
              Update
            </button>
          )}
          <button type="button" className={ACTION} onClick={openLink}>
            Change…
          </button>
          <button
            type="button"
            className={`${ACTION} ml-auto`}
            onClick={() => links.unlink(chart.id)}
          >
            Unlink
          </button>
        </div>
      ) : null}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {status.kind === 'saved'
          ? "These numbers come from a sheet you can't open, as last saved."
          : 'These numbers come from the sheet.'}
      </p>
    </div>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
