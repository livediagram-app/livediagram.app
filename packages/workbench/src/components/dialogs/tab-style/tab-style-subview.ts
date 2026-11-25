'use client';

// A panel's own level inside Tab Style (each product's 011-theme/canvas-and-theme-dialog.md, Page Design's Layers):
// while a panel shows one, the dialog's breadcrumb is that level's, back to the panel, in place of the panel's own,
// so a level replaces the screen before it whole rather than stacking a second breadcrumb under the first.
import { createContext, useContext, useEffect } from 'react';

// `line`: the header's line under the level's name, in place of the panel's.
export type TabStyleSubView = { current: string; line?: string; onBack: () => void };

export const TabStyleSubViewContext = createContext<(sub: TabStyleSubView | null) => void>(
  () => {},
);

/** Shows `sub` as the dialog's breadcrumb while it is set; null gives the panel's own back. */
export function useTabStyleSubView(sub: TabStyleSubView | null): void {
  const set = useContext(TabStyleSubViewContext);
  const current = sub?.current ?? null;
  const line = sub?.line;
  const onBack = sub?.onBack;
  useEffect(() => {
    set(current !== null && onBack ? { current, onBack, ...(line ? { line } : {}) } : null);
    // oxlint-disable-next-line react/exhaustive-deps -- onBack is a fresh closure each render; the level is its name
  }, [set, current, line]);
  useEffect(() => () => set(null), [set]);
}
