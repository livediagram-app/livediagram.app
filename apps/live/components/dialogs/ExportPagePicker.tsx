'use client';

// The Export dialog's pages in Infographic mode (docs/specs/007-editor/infographic-pages.md
// "Export"): All pages or One page (the shared segmented control), with One page the page itself,
// and a line saying what the download will be. With All pages a page is still picked, for the
// preview.
import type { LaidOutPage } from '@livediagram/document';
import { ACTIVE_SEGMENT, SEGMENT_TRACK, Select } from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { exportPageLabel, type PageExportFormat, type PageScope } from '@/lib/export-pages';

const SCOPES: [PageScope, string][] = [
  ['all', 'All pages'],
  ['one', 'One page'],
];

function outcome(scope: PageScope, format: PageExportFormat, count: number): string {
  if (scope === 'one') return format === 'pdf' ? 'A one-page PDF.' : `One ${format.toUpperCase()}.`;
  if (format === 'pdf') return count === 1 ? 'The page, as a PDF.' : `${count} pages, one PDF.`;
  return `A .zip of ${count} ${format.toUpperCase()} files, one per page.`;
}

export function ExportPagePicker({
  pages,
  page,
  scope,
  format,
  onScope,
  onPick,
}: {
  pages: readonly LaidOutPage[];
  page: LaidOutPage;
  scope: PageScope;
  format: PageExportFormat;
  onScope: (scope: PageScope) => void;
  onPick: (index: number) => void;
}) {
  const label = (p: LaidOutPage) => exportPageLabel(p, pages.length);
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Pages to export"
          className={`relative grid w-56 grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
        >
          <SegmentSlider
            count={SCOPES.length}
            index={SCOPES.findIndex(([id]) => id === scope)}
            className={ACTIVE_SEGMENT}
          />
          {SCOPES.map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={scope === id}
              onClick={() => onScope(id)}
              className={`relative z-10 rounded-md py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
                scope === id
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        {pages.length > 1 ? (
          <Select
            aria-label={scope === 'one' ? 'Page to export' : 'Page to preview'}
            size="sm"
            className="min-w-0 flex-1"
            value={page.index}
            onChange={(e) => onPick(Number(e.target.value))}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.index}>
                {scope === 'one' ? label(p) : `Preview: ${label(p)}`}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {outcome(scope, format, pages.length)}
      </p>
    </div>
  );
}
