'use client';

// Import from (livediagram's ImportFromToolbar): the pane header's group of the tools the host imports from, a muted
// label (hidden on a phone) and one button per source, arrow keys moving between them. What a source brings in
// lands where New would file an item, or in Shape Libraries for a library; the host does the importing (parsing a
// board takes the app's editor), in its own dialog or a page of its app.

import type { Placement } from '../types';
import { useLibraryHost } from './context';
import type { ImportSource } from './types';

export function ImportToolbar({
  placement,
  what = 'items',
}: {
  placement: Placement;
  /** `libraries`: only the sources that bring shape libraries (Shape Libraries' header). */
  what?: 'items' | 'libraries';
}) {
  const { imports } = useLibraryHost();
  if (!imports) return null;
  const sources = imports.sources.filter((s) => what === 'items' || s.libraries);
  if (sources.length === 0) return null;
  const run = (source: ImportSource) => imports.onImport(source, { what, placement });
  return (
    <div
      role="toolbar"
      aria-label="Import from"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (at < 0) return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        buttons[(at + step + buttons.length) % buttons.length]!.focus();
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-[2px] text-xs font-medium text-slate-500 shadow-sm sm:pl-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
    >
      <span aria-hidden className="hidden pr-1 sm:inline">
        Import from
      </span>
      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          title={source.name}
          aria-label={`Import from ${source.name}`}
          onClick={() => run(source)}
          className={`flex h-6 items-center justify-center rounded-md transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-700 ${
            source.icon ? 'w-6' : 'px-1.5'
          }`}
        >
          {source.icon ?? source.name}
        </button>
      ))}
    </div>
  );
}
