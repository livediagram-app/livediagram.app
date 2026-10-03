'use client';

// The Slide Deck panel's way in on an Infographic tab (docs/specs/007-editor/infographic-pages.md
// "Slides"): pick a page, add it as a slide. In place of "select elements to make a slide": a page
// is already the unit an infographic is built in.
import { useState } from 'react';
import { Select } from '@livediagram/ui';

export function PageSlidePicker({
  pages,
  onAdd,
}: {
  pages: readonly { id: string; label: string }[];
  onAdd: (pageId: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // The pick survives a page going away by falling back to the first.
  const pageId = pages.some((p) => p.id === picked) ? picked! : pages[0]?.id;
  if (!pageId) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Select
        aria-label="Page to add as a slide"
        size="sm"
        className="min-w-0 flex-1"
        value={pageId}
        onChange={(e) => setPicked(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => onAdd(pageId)}
        className="shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
      >
        Add as slide
      </button>
    </div>
  );
}
