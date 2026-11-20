'use client';

// The Export dialog's Print panel (docs/specs/020-import-export/print.md "The panel"): Current Page or Whole
// Document, the page with Current Page, a line saying what will print, and Print.
import { plural, type LaidOutPage } from '@liveknowledge/document';
import { BackBar, Button, Select } from '@liveknowledge/ui';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import { exportPageLabel } from '@/lib/export-pages';
import type { PrintScope } from '@/lib/print-pages';
import { Callout } from '@liveworkspace/ui/callout';

const SCOPES: readonly { id: PrintScope; label: string }[] = [
  { id: 'page', label: 'Current Page' },
  { id: 'document', label: 'Whole Document' },
];

/** What will print, in words: "1 page." or "12 pages from 3 tabs." */
export function printOutcome(pageCount: number, tabCount: number): string {
  const pages = plural(pageCount, 'page');
  return tabCount > 1 ? `${pages} from ${tabCount} tabs.` : `${pages}.`;
}

export function PrintPanel({
  pages,
  page,
  scope,
  counts,
  busy,
  error,
  onScope,
  onPick,
  onPrint,
  onBack,
}: {
  pages: readonly LaidOutPage[];
  page: LaidOutPage;
  scope: PrintScope;
  // The sheets the scope prints, and how many tabs they come from.
  counts: { pages: number; tabs: number };
  busy: boolean;
  error: string | null;
  onScope: (scope: PrintScope) => void;
  onPick: (index: number) => void;
  onPrint: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <BackBar label="All Formats" current="Print" onClick={onBack} disabled={busy} />
      <div className="mt-3 flex flex-col gap-2.5 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedRadio
            label="What to print"
            options={SCOPES}
            value={scope}
            onChange={onScope}
            className="w-64"
          />
          {scope === 'page' && pages.length > 1 ? (
            <Select
              aria-label="Page to print"
              size="sm"
              className="min-w-0 flex-1"
              value={page.index}
              onChange={(e) => onPick(Number(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.index}>
                  {exportPageLabel(p, pages.length)}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        <p data-print-outcome="" className="text-xs text-slate-600 dark:text-slate-300">
          {printOutcome(counts.pages, counts.tabs)} Each page prints on its own sheet, at its own
          size.
        </p>
      </div>
      {error ? (
        <Callout tone="error" role="alert" className="mt-4">
          {error}
        </Callout>
      ) : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button variant="primary" size="md" onClick={onPrint} busy={busy}>
          {busy ? 'Preparing…' : 'Print'}
        </Button>
      </div>
    </div>
  );
}
