'use client';

// The type editor's tabs (docs/specs/026-plan/item-types.md "Editing a type"): General, Fields and Statuses, one
// panel showing at a time. A tab holding what stops Save carries a red dot. Arrow keys move between tabs, Home and
// End go to the ends, as a tablist does.
import { useId, type KeyboardEvent, type ReactNode } from 'react';

export const TYPE_EDITOR_TABS = ['general', 'fields', 'statuses'] as const;
export type TypeEditorTab = (typeof TYPE_EDITOR_TABS)[number];

export const TYPE_EDITOR_TAB_LABELS: Record<TypeEditorTab, string> = {
  general: 'General',
  fields: 'Fields',
  statuses: 'Statuses',
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
        role="tablist"
        aria-label="Card type settings"
        className="flex gap-1 border-b border-slate-100 px-5 dark:border-slate-800"
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
              className={`relative -mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                on
                  ? 'border-brand-500 text-slate-900 dark:text-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
