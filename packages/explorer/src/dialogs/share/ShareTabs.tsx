'use client';

// The Share dialog's two tabs, there only when the host adds one of its own (livediagram's Community): Passes, the
// links handed out, and the host's. The chosen tab draws its own underline (two tabs need no sliding bar); arrow keys
// move between them. livediagram's ShareTabs from before the Explorer split, with the host's badge (words, never a
// dot) in place of its dot.

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ShareView } from './parts';

const VIEWS: readonly ShareView[] = ['passes', 'app'];

export const shareTabId = (v: ShareView) => `share-tab-${v}`;
export const sharePanelId = (v: ShareView) => `share-panel-${v}`;

export function ShareTabs({
  view,
  onView,
  appLabel,
  appBadge,
}: {
  view: ShareView;
  onView: (view: ShareView) => void;
  appLabel: string;
  appBadge?: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = VIEWS[(VIEWS.indexOf(view) + step + VIEWS.length) % VIEWS.length]!;
    onView(next);
    listRef.current?.querySelector<HTMLButtonElement>(`#${shareTabId(next)}`)?.focus();
  };
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Share"
      onKeyDown={onKey}
      className="relative flex shrink-0 gap-1 border-b border-slate-100 px-4 dark:border-slate-800"
    >
      {VIEWS.map((v) => {
        const on = v === view;
        return (
          <button
            key={v}
            id={shareTabId(v)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={sharePanelId(v)}
            tabIndex={on ? 0 : -1}
            onClick={() => onView(v)}
            className={`relative flex items-center gap-1.5 px-2 py-2.5 text-[13px] font-medium transition duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              on
                ? 'text-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {v === 'passes' ? 'Passes' : appLabel}
            {on ? (
              <span
                aria-hidden
                className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-500"
              />
            ) : null}
            {v === 'app' && appBadge ? appBadge : null}
          </button>
        );
      })}
    </div>
  );
}
