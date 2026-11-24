'use client';

// The Tab Style home's Page Design row (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the tab design's
// name ("Animated" after it while it moves, or "None") and a small tile of it, laid onto this editor's profile.
import { useMemo } from 'react';
import { pageDesignLabel, type BackgroundPattern } from '@livedocuments/document';
import type { TabStyleProfile } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabLook } from '@/lib/tab-looks';
import { TAB_STYLE_PROFILE } from '../tab-style-profile';
import type { TabStylePages } from '../tab-style-pages';
import { DesignTileImage } from './DesignTile';

export function designRowValue(design: { id: string; animate?: true } | undefined): string {
  if (!design) return 'None';
  return `${pageDesignLabel(design.id)}${design.animate ? ', Animated' : ''}`;
}

export function useDesignRow(pages: TabStylePages): TabStyleProfile<TabLook, BackgroundPattern> {
  const door = pages.design;
  const design = door?.tabDesign;
  const theme = door?.theme;
  const paperDark = door?.paperDark ?? false;
  return useMemo(() => {
    const base = TAB_STYLE_PROFILE.base;
    const icon =
      design && theme ? (
        <span className="block h-5 w-8 overflow-hidden rounded-sm ring-1 ring-slate-200 dark:ring-slate-600">
          <DesignTileImage input={{ design, theme, paperDark, idPrefix: 'pdr-' }} />
        </span>
      ) : undefined;
    return {
      ...TAB_STYLE_PROFILE,
      base: {
        ...base,
        panelValues: { ...base.panelValues, design: designRowValue(design) },
        ...(icon ? { panelIcons: { ...base.panelIcons, design: icon } } : {}),
      },
    };
  }, [design, theme, paperDark]);
}
