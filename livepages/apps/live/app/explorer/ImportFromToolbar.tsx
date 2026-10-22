'use client';

import { Tooltip } from '@livediagram/ui';
import type { ImportSource, ImportSourceId } from './import-sources';

// The Explorer page header's "Import from" group (docs/specs/013-workspace/folders.md): Help's
// outline style and height, a muted label (hidden below `sm`), one icon button per source.
export function ImportFromToolbar({
  sources,
  onImport,
}: {
  sources: readonly ImportSource[];
  onImport: (id: ImportSourceId) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Import from"
      // A toolbar moves focus between its buttons with the arrow keys.
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (at < 0) return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        buttons[(at + step + buttons.length) % buttons.length]!.focus();
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white py-[2px] pr-[2px] pl-[2px] text-xs font-medium text-slate-500 shadow-sm sm:pl-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
    >
      <span aria-hidden className="hidden pr-1 text-optical-line sm:inline">
        Import from
      </span>
      {sources.map((source) => (
        <Tooltip key={source.id} label={source.name}>
          <button
            type="button"
            aria-label={`Import from ${source.name}`}
            onClick={() => onImport(source.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:hover:bg-slate-700"
          >
            {source.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
