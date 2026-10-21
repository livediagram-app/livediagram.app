'use client';

import { createContext, useContext, type ReactNode } from 'react';

// One section's rows as a single grouped card, iOS-style (docs/specs/007-editor/user-preferences.md
// "Grouped rows"): the rows share the card, split by hairlines, rather than each drawing its own
// box. A row inside one draws as a bare cell; a row outside one (a panel reusing SettingsRow on its
// own) draws its own card, so it looks the same either way.
const InGroup = createContext(false);

/** Whether the row being drawn sits inside a SettingsGroup. */
export function useInSettingsGroup(): boolean {
  return useContext(InGroup);
}

// The card's frame. No overflow clipping: a help link's hover card has to escape it, so the
// first and last cells round their own corners instead (`rounded-[inherit]` on each cell).
export const SETTINGS_CARD =
  'rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

// A cell's slot in the card: the hairline above every cell but the first, and the card's
// corners on the first and last, so a cell's hover tint follows the card's outline.
export const SETTINGS_CARD_SLOT =
  'border-t border-slate-100 first:rounded-t-xl first:border-t-0 last:rounded-b-xl dark:border-slate-700/70';

export function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className={`flex flex-col ${SETTINGS_CARD}`}>
      <InGroup.Provider value>{children}</InGroup.Provider>
    </div>
  );
}

// The rows nested under a parent row (a panel's Enable switch, Power User Mode), inside the same
// card: indented and faintly tinted, so they read as that row's own settings.
export function SettingsGroupChildren({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-col bg-slate-50/80 pl-5 dark:bg-slate-900/30 ${SETTINGS_CARD_SLOT}`}
    >
      {children}
    </div>
  );
}
