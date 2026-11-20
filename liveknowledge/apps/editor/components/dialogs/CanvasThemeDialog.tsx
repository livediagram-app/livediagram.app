'use client';

// The Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from a page's Style button (or, on a tab
// with no pages yet, the Theme & canvas dock button):
// the one dialog every editor shares (@liveworkspace/workbench, liveworkspace/docs/specs/011-workbench/tab-style.md),
// handed this editor's profile. Loaded on demand (canvas-theme-dialog-loader.ts), the profile with it.

import { useMemo } from 'react';
import { themeBackgroundPresets, type BackgroundPattern } from '@liveknowledge/document';
import {
  TabStyleDialog,
  type TabStyleDialogProps,
} from '@liveworkspace/workbench/components/dialogs/tab-style/TabStyleDialog';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabLook } from '@/lib/tab-looks';
import { newPageBackgroundLabel } from '@/lib/new-page-background';
import { getTheme } from '@/lib/themes';
import { TAB_STYLE_PROFILE } from './tab-style-profile';
import { TabStylePagesContext, type TabStylePages } from './tab-style-pages';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = TabStyleView;

// The tab's pages ride beside the shared props (tab-style-pages.ts): the New Page Background panel, the page preview
// and an article's Style row read them; the Canvas row names the background new pages start on.
export function CanvasThemeDialog({
  pages,
  ...props
}: TabStyleDialogProps<TabLook, BackgroundPattern> & { pages: TabStylePages }) {
  const summary = useMemo(
    () =>
      newPageBackgroundLabel(
        pages.newPageBackground,
        themeBackgroundPresets(getTheme(pages.themeId)),
      ),
    [pages.newPageBackground, pages.themeId],
  );
  return (
    <TabStylePagesContext.Provider value={pages}>
      <TabStyleDialog profile={TAB_STYLE_PROFILE} canvasSummary={summary} {...props} />
    </TabStylePagesContext.Provider>
  );
}
