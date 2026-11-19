'use client';

// The Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from the Theme & canvas dock button:
// the one dialog every editor shares (@liveworkspace/workbench, liveworkspace/docs/specs/011-workbench/tab-style.md),
// handed this editor's profile. Loaded on demand (canvas-theme-dialog-loader.ts), the profile with it.

import { useMemo, useState } from 'react';
import type { BackgroundPattern } from '@livedesign/design';
import {
  TabStyleDialog,
  type TabStyleDialogProps,
} from '@liveworkspace/workbench/components/dialogs/tab-style/TabStyleDialog';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabLook } from '@/lib/tab-looks';
import type { ThemeApplyOptions } from '@/lib/tab-theme-apply';
import { newPageBackgroundLabel } from '@/lib/new-page-background';
import { themeBackgroundPresets } from '@/lib/page-paint';
import { getTheme } from '@/lib/themes';
import { TAB_STYLE_PROFILE } from './tab-style-profile';
import { TabStylePagesContext, type TabStylePages } from './tab-style-pages';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = TabStyleView;

type DoorPages = Omit<TabStylePages, 'keepElementColours' | 'onSetKeepElementColours'>;

// The tab's pages ride beside the shared props (tab-style-pages.ts): the New Page Background panel, the frame
// preview and the Element Colours row read them; the Canvas row names the background new pages start on. Element
// Colours is this open's own choice, handed to every theme and look the dialog applies.
export function CanvasThemeDialog({
  pages: given,
  onSetTheme,
  onApplyLook,
  ...props
}: Omit<TabStyleDialogProps<TabLook, BackgroundPattern>, 'onSetTheme' | 'onApplyLook'> & {
  pages: DoorPages;
  onSetTheme: (id: string, options?: ThemeApplyOptions) => void;
  onApplyLook: (look: string | TabLook, options?: ThemeApplyOptions) => void;
}) {
  const [keepElementColours, setKeepElementColours] = useState(false);
  const pages = useMemo<TabStylePages>(
    () => ({ ...given, keepElementColours, onSetKeepElementColours: setKeepElementColours }),
    [given, keepElementColours],
  );
  const options = keepElementColours ? { keepElementColours } : undefined;
  const summary = useMemo(
    () =>
      pages.kind === 'photo'
        ? 'Around the pages'
        : newPageBackgroundLabel(
            pages.newPageBackground,
            themeBackgroundPresets(getTheme(pages.themeId)),
          ),
    [pages.kind, pages.newPageBackground, pages.themeId],
  );
  return (
    <TabStylePagesContext.Provider value={pages}>
      <TabStyleDialog
        profile={TAB_STYLE_PROFILE}
        canvasSummary={summary}
        onSetTheme={(id) => onSetTheme(id, options)}
        onApplyLook={(look) => onApplyLook(look, options)}
        {...props}
      />
    </TabStylePagesContext.Provider>
  );
}
