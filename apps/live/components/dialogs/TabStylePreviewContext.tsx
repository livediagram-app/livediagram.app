'use client';

// Hover to preview inside Tab Style (docs/specs/011-theme/canvas-and-theme-dialog.md "Hover to preview"): the dialog
// names the tab it styles; any option inside it (a look, a theme, a finish, a typeface, a size, a pattern) asks
// `usePreviewHover` for pointer handlers that draw the tab as that option would make it (lib/tab-style-preview.ts).
// Mouse only: a touch has no hover, and a tap commits. Outside the dialog (the palette accordion) the hook gives
// nothing, so the shared controls stay as they were.
import { createContext, useContext, useEffect, type PointerEvent, type ReactNode } from 'react';
import type { Tab } from '@livediagram/document';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { setTabStylePreview } from '@/lib/tab-style-preview';

const TabStyleTabContext = createContext<string | null>(null);

export function TabStylePreviewProvider({
  tabId,
  children,
}: {
  tabId: string;
  children: ReactNode;
}) {
  // Whatever is previewing when the dialog closes stops.
  useEffect(() => () => setTabStylePreview(tabId, null), [tabId]);
  return <TabStyleTabContext.Provider value={tabId}>{children}</TabStyleTabContext.Provider>;
}

type HoverHandlers = {
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
};

/** Pointer handlers previewing `transform` on the dialog's tab while a mouse rests on the control. */
export function usePreviewHover(transform: (tab: Tab) => Tab): HoverHandlers {
  const tabId = useContext(TabStyleTabContext);
  if (!tabId) return {};
  return {
    onPointerEnter: onMouseHover(() => setTabStylePreview(tabId, transform)),
    onPointerLeave: onMouseHover(() => setTabStylePreview(tabId, null)),
  };
}
