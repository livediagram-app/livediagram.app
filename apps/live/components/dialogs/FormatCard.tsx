import type { ReactNode } from 'react';

// The pick-a-format tile used by both the export and import dialogs: a
// glyph over a title and a two-line description, the whole thing a button.
//
// ExportCard and ImportCard were character-for-character identical, down to
// the eight hover classes and the line-clamp. Two copies of a tile is how one
// of them ends up with a different hover colour after a theme pass touches
// only the file someone happened to open.
//
// The glyph arrives as children rather than as a format name, because that is
// the part the two dialogs genuinely disagree about: export draws bespoke art
// per format (a picture for PNG, a page for PDF), import draws one uniform
// lettered chip. Passing the icon in keeps this component out of that
// argument.
export function FormatCard({
  title,
  description,
  onClick,
  children,
}: {
  title: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <div className="flex h-12 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        {children}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </button>
  );
}
