'use client';

// The Import dialog's preview of a whole plan's file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole
// Plan): under the All Imports back bar, the plan's name and what it holds, as the tools' preview shows a board, then
// Import as New Plan in the footer. The file was read and summarised by the dialog; the import is usePlanFileImport's.
import type { ReactNode } from 'react';
import type { ProjectFileSummary } from '@liveplanner/project';
import { BrandMark, Button, DialogFooter } from '@liveplanner/ui';
import { ImportError } from './ImportError';
import { PLAN_PICTURES, PLAN_RULES_OFF, planFileCounts } from './plan-file-copy';

const NOTE =
  'rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';

export function WholePlanPreview({
  head,
  summary,
  error,
  busy,
  onChooseAnother,
  onImport,
}: {
  // What heads the body (the dialog's back bar).
  head: ReactNode;
  summary: ProjectFileSummary;
  // Why the import, or a file dropped on the preview, was not taken.
  error: string | null;
  // 'importing' while the plan is made, 'reading' while another file is read; either holds the buttons.
  busy: 'reading' | 'importing' | null;
  onChooseAnother: () => void;
  onImport: () => void;
}) {
  const counts = planFileCounts(summary);
  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {head}
        {error ? <ImportError>{error}</ImportError> : null}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25">
            <BrandMark className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">liveplanner plan</p>
            <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              {summary.name.trim() || 'Untitled'}
            </p>
          </div>
        </div>
        <ul
          aria-label="What it holds"
          className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]"
        >
          {counts.map((c) => (
            <li
              key={c.label}
              className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <span className="text-[18px] leading-tight font-semibold text-slate-900 tabular-nums dark:text-slate-50">
                {c.n.toLocaleString()}
              </span>
              <span className="text-[12px] text-slate-500 dark:text-slate-400">{c.label}</span>
            </li>
          ))}
        </ul>
        {summary.rules > 0 ? <p className={NOTE}>{PLAN_RULES_OFF}</p> : null}
        {summary.pictures ? <p className={NOTE}>{PLAN_PICTURES}</p> : null}
      </div>
      <DialogFooter>
        <Button
          variant="secondary"
          size="md"
          className="shrink-0 whitespace-nowrap"
          onClick={onChooseAnother}
          busy={busy !== null}
        >
          Choose Another File
        </Button>
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Importing…", so the label swap moves nothing.
          className="min-w-[10.5rem] shrink-0"
          onClick={onImport}
          busy={busy !== null}
        >
          {busy === 'importing' ? 'Importing…' : 'Import as New Plan'}
        </Button>
      </DialogFooter>
    </>
  );
}
