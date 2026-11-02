'use client';

// The Export dialog's PowerPoint and Word panel (docs/specs/020-import-export/office-export.md "The panel"): what the
// file holds and what stays editable in it, the first page's preview, then the making, with its progress and Cancel.
// Loaded only when the card opens, with the writers it calls.
import type { Deck, LaidOutPage, Tab } from '@livedocuments/document';
import { BackBar, Button, CheckIcon, trustedHtml } from '@livedocuments/ui';
import type { ImageExportOpts } from '@/lib/export-tab';
import { OFFICE_EXPORT_MESSAGES } from '@/lib/office-export';
import {
  OFFICE_CARDS,
  OFFICE_EDITABLE,
  officeSummary,
  type OfficeFormat,
} from '@/lib/office-export/summary';
import { useOfficeExport } from './useOfficeExport';

const MAKING_COPY: Record<OfficeFormat, string> = {
  pptx: 'Making the deck…',
  docx: 'Making the document…',
};

export default function OfficeExportPanel({
  format,
  tab,
  pages,
  deck,
  title,
  baseName,
  render,
  previewSvg,
  ready,
  onDone,
  onBack,
}: {
  format: OfficeFormat;
  tab: Tab;
  pages: readonly LaidOutPage[];
  deck?: Deck;
  title: string;
  baseName: string;
  render: Pick<ImageExportOpts, 'images' | 'resolveTabWindow' | 'tabWindowFontIds'>;
  /** The first page as the image formats preview it; empty until its images are loaded. */
  previewSvg: string;
  /** False until the images and tab windows the pictures draw are loaded. */
  ready: boolean;
  onDone: () => void;
  onBack: () => void;
}) {
  const office = useOfficeExport({ format, tab, pages, deck, title, baseName, render, onDone });
  const making = office.phase.kind === 'making';
  const percent = office.phase.kind === 'making' ? Math.round(office.phase.progress * 100) : 0;
  const card = OFFICE_CARDS[format];

  return (
    <div>
      <BackBar label="All formats" current={card.title} onClick={onBack} disabled={making} />
      <div className="mt-3 mb-4 flex h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
        {previewSvg ? (
          <div
            data-testid="export-preview"
            className="flex max-h-full max-w-full items-center justify-center [&>svg]:max-h-[176px] [&>svg]:w-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: trustedHtml(previewSvg) }}
          />
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">Preparing preview…</span>
        )}
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {officeSummary(format, tab, pages, deck)}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5" aria-label="What stays editable">
          {OFFICE_EDITABLE[format].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <CheckIcon className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      {office.phase.kind === 'error' ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {OFFICE_EXPORT_MESSAGES[office.phase.failure]}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        {making ? (
          <>
            <div
              role="progressbar"
              aria-label={MAKING_COPY[format]}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
                style={{ width: `${percent}%` }}
              />
            </div>
            <Button variant="secondary" size="md" onClick={office.cancel}>
              Cancel
            </Button>
          </>
        ) : null}
        <Button
          variant="primary"
          size="md"
          onClick={() => void office.make()}
          disabled={making || !ready}
        >
          {making ? `${MAKING_COPY[format]} ${percent}%` : `Download ${card.title}`}
        </Button>
      </div>
    </div>
  );
}
