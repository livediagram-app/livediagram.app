'use client';

import { useRef, type KeyboardEvent } from 'react';

export type ShareTab = 'passes' | 'community';

const SHARE_TABS: readonly ShareTab[] = ['passes', 'community'];
const SHARE_TAB_LABELS: Record<ShareTab, string> = { passes: 'Passes', community: 'Community' };

export const shareTabId = (t: ShareTab) => `share-tab-${t}`;
export const sharePanelId = (t: ShareTab) => `share-panel-${t}`;

// The Share dialog's two tabs (docs/specs/007-editor/live-app.md "Share dialog"): Passes, the links you hand out, and
// Community, publishing to the public gallery. The selected tab draws its own underline (two tabs need no sliding
// bar, and a measured one missed its first paint inside the dialog); arrow keys move between tabs.
export function ShareTabs({
  tab,
  onTab,
  listed,
}: {
  tab: ShareTab;
  onTab: (tab: ShareTab) => void;
  // The document is in the Community: the tab says so with a dot.
  listed: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next =
      SHARE_TABS[(SHARE_TABS.indexOf(tab) + step + SHARE_TABS.length) % SHARE_TABS.length]!;
    onTab(next);
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
      {SHARE_TABS.map((t) => {
        const on = t === tab;
        return (
          <button
            key={t}
            id={shareTabId(t)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={sharePanelId(t)}
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(t)}
            className={`relative flex items-center gap-1.5 px-2 py-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              on
                ? 'text-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {SHARE_TAB_LABELS[t]}
            {on ? (
              <span
                aria-hidden
                className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-500"
              />
            ) : null}
            {t === 'community' && listed ? (
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                role="img"
                aria-label="Public"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
