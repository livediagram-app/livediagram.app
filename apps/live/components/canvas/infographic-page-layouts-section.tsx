'use client';

// The page panel's Layouts (docs/specs/007-editor/infographic-pages.md "Layouts"): a grid of the
// eight layouts, each previewed for this page. Onto an empty page a press places it at once; onto
// a page with content the grid asks first, inline, naming how much would go.
import { useState } from 'react';
import type { LaidOutPage } from '@livediagram/document';
import { PAGE_LAYOUTS, type PageLayoutId } from '@livediagram/templates';
import { Button, HoverCard } from '@livediagram/ui';
import { LayoutThumb } from './infographic-layout-thumb';
import { PanelSection } from './infographic-page-panel-sections';

export function LayoutsSection({
  page,
  contentCount,
  onApply,
}: {
  page: LaidOutPage;
  contentCount: number;
  onApply: (layout: PageLayoutId) => void;
}) {
  const [pending, setPending] = useState<PageLayoutId | null>(null);
  const pick = (id: PageLayoutId) => {
    if (contentCount === 0) onApply(id);
    else setPending(id);
  };
  const pendingLabel = PAGE_LAYOUTS.find((l) => l.id === pending)?.label;
  return (
    <PanelSection title="Start from a layout">
      {pending ? (
        <div
          role="alertdialog"
          aria-label="Replace this page's content?"
          className="mb-2 rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
        >
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Replace this page&apos;s content?
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            {contentCount === 1 ? 'The 1 element' : `The ${contentCount} elements`} on it make way
            for {pendingLabel}. Undo brings them back.
          </p>
          <div className="mt-2 flex justify-end gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              size="xs"
              autoFocus
              onClick={() => {
                onApply(pending);
                setPending(null);
              }}
            >
              Replace
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        {PAGE_LAYOUTS.map((l) => (
          <HoverCard key={l.id} title={l.label} description={l.description}>
            <button
              type="button"
              onClick={() => pick(l.id)}
              aria-pressed={pending === l.id}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
                pending === l.id ? 'bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/15' : ''
              }`}
            >
              <LayoutThumb layout={l.id} page={page} />
              {l.label}
            </button>
          </HoverCard>
        ))}
      </div>
    </PanelSection>
  );
}
