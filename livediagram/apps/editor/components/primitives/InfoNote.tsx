import type { ReactNode } from 'react';
import { lucideInfo } from '@livediagram/icons/lucide';
import { Glyph, Prims } from '@livediagram/ui';

// A small bordered note with an info glyph: the quiet line under an Explorer
// view's title that says what the view is (the Dynamic folders, the Trash).
// `className` is for the caller's spacing only.
export function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-snug text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400${
        className ? ` ${className}` : ''
      }`}
    >
      <Glyph size={14} units={24} className="mt-px shrink-0 text-slate-400">
        <Prims prims={lucideInfo} />
      </Glyph>
      <span>{children}</span>
    </div>
  );
}
