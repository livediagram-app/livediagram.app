'use client';

// The Export dialog's page choice in Illustrate mode (docs/specs/007-editor/illustrate-pages.md
// "Export"): a PNG or SVG is one page, chosen here (the first by default); a PDF is every page,
// which this says instead.
import { pageLabel, type LaidOutPage } from '@livediagram/document';
import { Select } from '@livediagram/ui';

export function ExportPagePicker({
  pages,
  page,
  allPages,
  onPick,
}: {
  pages: readonly LaidOutPage[];
  page: LaidOutPage;
  allPages: boolean;
  onPick: (index: number) => void;
}) {
  const label = (p: LaidOutPage) => pageLabel(p, p.index, Math.max(2, pages.length));
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Page</span>
      {allPages ? (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {pages.length === 1
            ? 'The page, as its own PDF page.'
            : `All ${pages.length} pages, one PDF page each.`}
        </span>
      ) : (
        <Select
          aria-label="Page to export"
          size="sm"
          value={page.index}
          onChange={(e) => onPick(Number(e.target.value))}
        >
          {pages.map((p) => (
            <option key={p.id} value={p.index}>
              {label(p)}
            </option>
          ))}
        </Select>
      )}
      {allPages && pages.length > 1 ? (
        <Select
          aria-label="Page to preview"
          size="sm"
          className="ml-auto"
          value={page.index}
          onChange={(e) => onPick(Number(e.target.value))}
        >
          {pages.map((p) => (
            <option key={p.id} value={p.index}>
              {label(p)}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
