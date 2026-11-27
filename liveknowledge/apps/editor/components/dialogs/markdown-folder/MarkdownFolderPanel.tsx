'use client';

// The Export dialog's Markdown Folder panel (docs/specs/020-import-export/knowledgebase-export.md "The panel"): what
// the zip will hold, then the making, a page at a time, with its progress and Cancel, then the download.
import { plural, pluralGrouped } from '@liveknowledge/document';
import { BackBar, Button, CheckIcon } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useMarkdownFolderExport, type MarkdownFolderRun } from './useMarkdownFolderExport';

/** What every file holds, as the panel lists it. */
export const MARKDOWN_FOLDER_HOLDS: readonly string[] = [
  'Each page’s title, owner, last update and labels at the top of its file',
  'Links between pages as relative links, so they work in any Markdown viewer',
  'Pictures as files in a pictures folder',
  'Imports back into liveknowledge, Confluence, Notion and Obsidian',
];

const title = (count: number) => {
  const pages = pluralGrouped(count, 'Page');
  return `${pages}, in Folders Following the Page Tree`;
};

export function MarkdownFolderPanel({
  counts,
  run,
  onDownload,
  onDone,
  onBack,
}: {
  /** The pages this editor lists, and the connected files that stay out. */
  counts: { pages: number; connected: number };
  run: MarkdownFolderRun;
  onDownload: (blob: Blob) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const { phase, make, cancel } = useMarkdownFolderExport({ run, onDownload, onDone });
  const making = phase.kind === 'making';
  const percent =
    phase.kind === 'making' && phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;
  const progressText =
    phase.kind === 'making'
      ? phase.total > 0
        ? `Preparing ${phase.done.toLocaleString('en-GB')} of ${pluralGrouped(phase.total, 'Page')}`
        : 'Reading the Page Tree…'
      : '';

  return (
    <div>
      <BackBar label="All Formats" current="Markdown Folder" onClick={onBack} disabled={making} />
      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {title(counts.pages)}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5" aria-label="What the zip holds">
          {MARKDOWN_FOLDER_HOLDS.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <CheckIcon className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {counts.connected > 0 ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {plural(counts.connected, 'connected file')} stay out: they belong to other apps.
          </p>
        ) : null}
      </div>
      {phase.kind === 'error' ? (
        <Callout tone="error" role="alert" className="mt-3">
          {phase.message}
        </Callout>
      ) : null}
      {phase.kind === 'done' ? (
        <Callout tone="warning" role="status" className="mt-3">
          Downloaded. {plural(phase.missingPictures, 'Picture')} Could Not Be Read: their words are
          kept.
        </Callout>
      ) : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        {making ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div
                role="progressbar"
                aria-label={progressText}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              >
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span aria-live="polite" className="text-xs text-slate-600 dark:text-slate-300">
                {progressText}
              </span>
            </div>
            <Button variant="secondary" size="md" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="primary" size="md" onClick={() => void make()}>
            Download .zip
          </Button>
        )}
      </div>
    </div>
  );
}
