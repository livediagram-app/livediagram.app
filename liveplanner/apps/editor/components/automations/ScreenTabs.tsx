'use client';

// The Automations screen's tabs (docs/specs/026-plan/automations.md "The Automations screen"): Rules · n, Audit Trail
// and Templates, with the Runs today meter at the right (under the tab on a phone, where the dialog draws it).

import type { ReactNode } from 'react';

export type ScreenTab = 'rules' | 'runs' | 'templates';

const TAB =
  'touch-target-y relative -mb-px cursor-pointer border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition motion-reduce:transition-none';
const TAB_ON = 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300';
const TAB_OFF =
  'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100';

export function ScreenTabs({
  current,
  rules,
  phone,
  meter,
  onTab,
}: {
  current: ScreenTab;
  // The rule count, once the list is read.
  rules: number | null;
  phone: boolean;
  meter: ReactNode;
  onTab: (tab: ScreenTab) => void;
}) {
  const tabs: readonly { tab: ScreenTab; label: string }[] = [
    { tab: 'rules', label: rules === null ? 'Rules' : `Rules · ${rules}` },
    { tab: 'runs', label: 'Audit Trail' },
    { tab: 'templates', label: 'Templates' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Automations"
      className={`flex items-end gap-5 border-b border-slate-100 dark:border-slate-800 ${phone ? 'px-4' : 'px-6'}`}
    >
      {tabs.map((t) => (
        <button
          key={t.tab}
          type="button"
          role="tab"
          aria-selected={current === t.tab}
          onClick={() => onTab(t.tab)}
          className={`${TAB} ${current === t.tab ? TAB_ON : TAB_OFF}`}
        >
          {t.label}
        </button>
      ))}
      <span className="flex-1" />
      {phone ? null : <div className="pb-2">{meter}</div>}
    </div>
  );
}
