'use client';

// The Automations screen's tabs (docs/specs/026-plan/automations.md "The Automations screen"): Rules · n, Audit Trail
// and Templates, with the Runs today meter at the right (under the tab on a phone, where the dialog draws it). On a
// phone the bar is 48 px tall and each tab fills it, its label centred in a 44 px target, the underline at its foot.

import type { ReactNode } from 'react';

export type ScreenTab = 'rules' | 'runs' | 'templates';

const TAB =
  'touch-target-y relative -mb-px cursor-pointer border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition motion-reduce:transition-none';
// A phone's tab: the bar's full height, the label centred in it (the underline's 2 px is matched above it).
const PHONE_TAB =
  'relative -mb-px flex h-12 cursor-pointer items-center border-y-2 border-t-transparent px-1 text-[14px] font-medium transition motion-reduce:transition-none';
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
      className={`flex border-b border-slate-100 dark:border-slate-800 ${phone ? 'items-stretch gap-6 px-4' : 'items-end gap-5 px-6'}`}
    >
      {tabs.map((t) => (
        <button
          key={t.tab}
          type="button"
          role="tab"
          aria-selected={current === t.tab}
          onClick={() => onTab(t.tab)}
          className={`${phone ? PHONE_TAB : TAB} ${current === t.tab ? TAB_ON : TAB_OFF}`}
        >
          {t.label}
        </button>
      ))}
      <span className="flex-1" />
      {phone ? null : <div className="pb-2">{meter}</div>}
    </div>
  );
}
