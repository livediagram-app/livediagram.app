'use client';

// What the Tab Style dialog knows of the tab's pages (docs/specs/011-theme/canvas-and-theme-dialog.md "New Page
// Background", "Element colours"): the kind it styles, the background new pages start on and its setters, and
// whether a look or a theme recolours the elements (the tab's Element Colours) and its setter. The door
// (EditorModals, through CanvasThemeDialog) provides it; the profile's New Page Background panel, frame preview and
// Element Colours row read it, so the profile itself stays one constant.
import { createContext, useContext } from 'react';
import type { PageBackground, PageKind } from '@livedesign/design';

export type TabStylePages = {
  // The kind of the page someone is on; null on a tab with no pages yet.
  kind: PageKind | null;
  // The tab's New Page Background: undefined carries over the page before, `{}` is the plain paper.
  newPageBackground: PageBackground | undefined;
  // The tab's theme, for the theme's own gradients the panel offers.
  themeId: string;
  // The tab's pages that take a background (every one but a photo page): what Apply to Every Page reaches.
  units: number;
  onSet: (patch: Partial<PageBackground> | null) => void;
  onApplyToEveryPage: () => void;
  // Element Colours: Keep as They Are (true) or Follow the Theme, the tab's own (`Tab.keepElementColours`).
  keepElementColours: boolean;
  onSetKeepElementColours: (keep: boolean) => void;
};

const NONE: TabStylePages = {
  kind: null,
  newPageBackground: undefined,
  themeId: 'brand',
  units: 0,
  onSet: () => {},
  onApplyToEveryPage: () => {},
  keepElementColours: false,
  onSetKeepElementColours: () => {},
};

export const TabStylePagesContext = createContext<TabStylePages>(NONE);

export function useTabStylePages(): TabStylePages {
  return useContext(TabStylePagesContext);
}
