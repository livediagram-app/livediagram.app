'use client';

// The Automations screen's tabs (docs/specs/026-plan/automations.md "The Automations screen"): Rules · n, Audit Trail
// and Templates, with the Runs today meter at the right (under the tab on a phone, where the dialog draws it). On a
// phone the bar is 48 px tall and each tab fills it, its label centred in a 44 px target, the underline at its foot.
// The bar is one Tab stop, the open tab: Left and Right open the next tab (wrapping), Home and End the first and last,
// and focus follows. The meter stands beside the tab list, never in it (a tab list holds only tabs).

import type { KeyboardEvent, ReactNode } from 'react';

export type ScreenTab = 'rules' | 'runs' | 'templates';

const ORDER: readonly ScreenTab[] = ['rules', 'runs', 'templates'];

/** The ids joining the open tab and the dialog's one panel: the panel is labelled by the tab, the tab controls it. */
export const screenTabId = (prefix: string, tab: ScreenTab) => `${prefix}-tab-${tab}`;
export const screenPanelId = (prefix: string) => `${prefix}-panel`;

// Where an arrow key, Home or End moves from `at`; null for any other key.
export function screenTabKey(key: string, at: ScreenTab): ScreenTab | null {
  const i = ORDER.indexOf(at);
  const n = ORDER.length;
  if (key === 'ArrowRight') return ORDER[(i + 1) % n]!;
  if (key === 'ArrowLeft') return ORDER[(i - 1 + n) % n]!;
  if (key === 'Home') return ORDER[0]!;
  if (key === 'End') return ORDER[n - 1]!;
  return null;
}

const TAB =
  'touch-target-y relative -mb-px cursor-pointer border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition motion-reduce:transition-none';
// A phone's tab: the bar's full height, the label centred in it (the underline's 2 px is matched above it).
const PHONE_TAB =
  'relative -mb-px flex h-12 cursor-pointer items-center border-y-2 border-t-transparent px-1 text-[14px] font-medium transition motion-reduce:transition-none';
const TAB_ON = 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300';
const TAB_OFF =
  'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100';

export function ScreenTabs({
  idPrefix,
  current,
  rules,
  phone,
  meter,
  onTab,
}: {
  // Prefixes the tabs' and the panel's ids (screenTabId, screenPanelId).
  idPrefix: string;
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
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = screenTabKey(e.key, current);
    if (!next) return;
    e.preventDefault();
    onTab(next);
    document.getElementById(screenTabId(idPrefix, next))?.focus();
  };
  return (
    <div
      className={`flex border-b border-slate-100 dark:border-slate-800 ${phone ? 'items-stretch px-4' : 'items-end px-6'}`}
    >
      <div
        role="tablist"
        aria-label="Automations"
        className={`flex ${phone ? 'items-stretch gap-6' : 'items-end gap-5'}`}
      >
        {tabs.map((t) => {
          const on = current === t.tab;
          return (
            <button
              key={t.tab}
              type="button"
              role="tab"
              id={screenTabId(idPrefix, t.tab)}
              aria-selected={on}
              aria-controls={on ? screenPanelId(idPrefix) : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => onTab(t.tab)}
              onKeyDown={onKeyDown}
              className={`${phone ? PHONE_TAB : TAB} ${on ? TAB_ON : TAB_OFF}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <span className="flex-1" />
      {phone ? null : <div className="pb-2">{meter}</div>}
    </div>
  );
}
