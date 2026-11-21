'use client';

// The Automations screen's tabs (liveplanner/docs/specs/026-plan/automations.md "The Automations screen"): Rules · n,
// Audit Trail, Templates and Connections, then any tab an app's own view asks for, with the Runs today meter at the
// right (under the tab on a phone, where the dialog draws it). On a phone the bar is 48 px tall and each tab fills
// it, its label centred in a 44 px target, the underline at its foot. The bar is one Tab stop, the open tab: Left and
// Right open the next tab (wrapping), Home and End the first and last, and focus follows. The meter stands beside the
// tab list, never in it (a tab list holds only tabs).

import type { KeyboardEvent, ReactNode } from 'react';

// The four every app has; an app's own tab is `view:<id>`.
export type ScreenTab = 'rules' | 'runs' | 'templates' | 'connections' | `view:${string}`;

export const SCREEN_TABS: readonly ScreenTab[] = ['rules', 'runs', 'templates', 'connections'];

const LABELS: Readonly<Record<string, string>> = {
  runs: 'Audit Trail',
  templates: 'Templates',
  connections: 'Connections',
};

/** The ids joining the open tab and the dialog's one panel: the panel is labelled by the tab, the tab controls it. */
export const screenTabId = (prefix: string, tab: ScreenTab) => `${prefix}-tab-${tab}`;
export const screenPanelId = (prefix: string) => `${prefix}-panel`;

/** The tab a key opens from `at`, in `order`: Left and Right wrap, Home and End jump; null for any other key. */
export function screenTabKey(
  key: string,
  at: ScreenTab,
  order: readonly ScreenTab[] = SCREEN_TABS,
): ScreenTab | null {
  const i = order.indexOf(at);
  const n = order.length;
  if (key === 'ArrowRight') return order[(i + 1) % n]!;
  if (key === 'ArrowLeft') return order[(i - 1 + n) % n]!;
  if (key === 'Home') return order[0]!;
  if (key === 'End') return order[n - 1]!;
  return null;
}

const TAB =
  'touch-target-y relative -mb-px cursor-pointer border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition motion-reduce:transition-none';
// On a phone the four tabs can be wider than the screen: the list scrolls sideways (PHONE_LIST), and it, not each
// tab, sits over the bar's line, so nothing a tab draws is clipped.
const PHONE_TAB =
  'relative flex h-12 shrink-0 cursor-pointer items-center whitespace-nowrap border-y-2 border-t-transparent px-1 text-[14px] font-medium transition focus-visible:-outline-offset-2 motion-reduce:transition-none';
const PHONE_LIST =
  '-mb-px min-w-0 items-stretch gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none]';
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
  extra = [],
}: {
  idPrefix: string;
  current: ScreenTab;
  // How many rules the item has; null until the list is read.
  rules: number | null;
  phone: boolean;
  meter: ReactNode;
  onTab: (tab: ScreenTab) => void;
  // The app's own tabs, after Connections.
  extra?: readonly { tab: ScreenTab; label: string }[];
}) {
  const tabs: readonly { tab: ScreenTab; label: string }[] = [
    { tab: 'rules', label: rules === null ? 'Rules' : `Rules · ${rules}` },
    ...SCREEN_TABS.slice(1).map((tab) => ({ tab, label: LABELS[tab]! })),
    ...extra,
  ];
  const order = tabs.map((t) => t.tab);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next = screenTabKey(e.key, current, order);
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
        className={`flex ${phone ? PHONE_LIST : 'items-end gap-5'}`}
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
      {phone ? null : <span className="flex-1" />}
      {phone ? null : <div className="pb-2">{meter}</div>}
    </div>
  );
}
