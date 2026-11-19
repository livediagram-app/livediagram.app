'use client';

// What the Tab Style dialog knows of the tab's pages (docs/specs/011-theme/canvas-and-theme-dialog.md "New Page
// Background"): the kind it styles, the background new pages start on and its setters. The door (CanvasThemeDialog)
// provides it; the profile's New Page Background panel, page preview and article row read it, so the profile itself
// stays one constant.
import { createContext, useContext } from 'react';
import type { PageBackground, PageKind } from '@livedocuments/document';

export type TabStylePages = {
  // The kind of the page someone is on; null on a tab with no pages yet.
  kind: PageKind | null;
  // The tab's New Page Background: undefined carries over the page before, `{}` is the plain paper.
  newPageBackground: PageBackground | undefined;
  // The tab's theme, for the theme's own gradients the panel offers.
  themeId: string;
  // The tab's pages, an article counted once: what Apply to Every Page reaches.
  units: number;
  onSet: (patch: Partial<PageBackground> | null) => void;
  onApplyToEveryPage: () => void;
  // Opens the article's own Style (an article page or a card); undefined elsewhere.
  onOpenArticleStyle?: () => void;
};

const NONE: TabStylePages = {
  kind: null,
  newPageBackground: undefined,
  themeId: 'brand',
  units: 0,
  onSet: () => {},
  onApplyToEveryPage: () => {},
};

export const TabStylePagesContext = createContext<TabStylePages>(NONE);

export function useTabStylePages(): TabStylePages {
  return useContext(TabStylePagesContext);
}
