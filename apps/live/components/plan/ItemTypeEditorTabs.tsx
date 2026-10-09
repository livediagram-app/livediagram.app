'use client';

// The type editor's tabs (docs/specs/026-plan/item-types.md "Editing a type"): Configuration, States and Display, one
// panel showing at a time, the underline sliding to the chosen tab. A tab holding what stops Save carries a red dot. Arrow keys move between tabs, Home and
// End go to the ends, as a tablist does.
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { SlidingTabUnderline } from '@/components/primitives/SlidingTabUnderline';

export const TYPE_EDITOR_TABS = ['configuration', 'statuses', 'display'] as const;
export type TypeEditorTab = (typeof TYPE_EDITOR_TABS)[number];

export const TYPE_EDITOR_TAB_LABELS: Record<TypeEditorTab, string> = {
  configuration: 'Configuration',
  statuses: 'States',
  display: 'Display',
};

export function ItemTypeEditorTabs({
  tab,
  onTab,
  flagged,
  panels,
}: {
  tab: TypeEditorTab;
  onTab: (next: TypeEditorTab) => void;
  // Tabs holding a problem that stops Save.
  flagged: ReadonlySet<TypeEditorTab>;
  panels: Record<TypeEditorTab, ReactNode>;
}) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabId = (t: TypeEditorTab) => `${base}-tab-${t}`;
  const panelId = (t: TypeEditorTab) => `${base}-panel-${t}`;
  const onKey = (e: KeyboardEvent) => {
    const i = TYPE_EDITOR_TABS.indexOf(tab);
    const last = TYPE_EDITOR_TABS.length - 1;
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % TYPE_EDITOR_TABS.length
        : e.key === 'ArrowLeft'
          ? (i + last) % TYPE_EDITOR_TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    const next = TYPE_EDITOR_TABS[to]!;
    onTab(next);
    document.getElementById(tabId(next))?.focus();
  };
  return (
    <>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Card type settings"
        className="relative flex gap-1 border-b border-slate-100 px-5 dark:border-slate-800"
        onKeyDown={onKey}
      >
        {TYPE_EDITOR_TABS.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              id={tabId(t)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId(t)}
              tabIndex={on ? 0 : -1}
              onClick={() => onTab(t)}
              className={`relative flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                on
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {TYPE_EDITOR_TAB_LABELS[t]}
              {flagged.has(t) ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-rose-500"
                  role="img"
                  aria-label="Needs attention"
                />
              ) : null}
            </button>
          );
        })}
        <SlidingTabUnderline list={listRef} selected={tab} />
      </div>
      {TYPE_EDITOR_TABS.map((t) => (
        <div
          key={t}
          id={panelId(t)}
          role="tabpanel"
          aria-labelledby={tabId(t)}
          hidden={t !== tab}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-slate-800 dark:text-slate-100"
        >
          {t === tab ? panels[t] : null}
        </div>
      ))}
    </>
  );
}
