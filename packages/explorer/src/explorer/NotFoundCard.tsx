'use client';

import { Button } from '@liveworkspace/ui';
import { useExplorer } from './context';

// A team or a folder the person can't reach (gone, left, never theirs, or a stale link): said plainly, with the
// way back to their own work, rather than a "Try again" that can never work. Its heading is an h2, under the
// pane's own h1 ("Team", "Folder").
export function NotFoundCard({ title, children }: { title: string; children: string }) {
  const { navigate, words } = useExplorer();
  return (
    <div className="flex items-center justify-center px-6 py-16" data-not-found="">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          404
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </p>
        <Button size="md" className="mt-6" onClick={() => navigate({ kind: 'all' })}>
          {`Back to your ${words.lowerMany}`}
        </Button>
      </div>
    </div>
  );
}
