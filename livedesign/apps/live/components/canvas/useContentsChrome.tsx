'use client';

// Pages mode's Contents in the chrome (docs/specs/007-editor/pages-mode.md "Contents"): docked
// as a sidebar down the canvas's left on a desktop until the person minimises it, else the popover
// over its cluster button (a bottom sheet on a phone, which never has the sidebar). Where it sits is
// the person's own choice, in their synced preferences (lib/contents-placement.ts).
import dynamic from 'next/dynamic';
import { useCallback, useEffect, type ReactNode } from 'react';
import { useUiScale } from '@/components/providers/ui-scale';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from '@liveworkspace/workbench/hooks/ui/useLocalStorageValue';
import {
  CONTENTS_SIDE_STORAGE_KEY,
  CONTENTS_SIDEBAR_MIN_PAGES,
  readContentsSide,
  type ContentsSide,
  readContentsPlacement,
  withContentsPlacement,
  type ContentsPlacement,
} from '@/lib/contents-placement';
import { track } from '@/lib/telemetry';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { CanvasChromeProps } from './CanvasChrome';

// Both load with Pages mode, not with the editor: a design without pages pays nothing.
const PageContentsPanel = dynamic(
  () => import('./PageContentsPanel').then((m) => m.PageContentsPanel),
  { ssr: false },
);
const PageContentsSidebar = dynamic(
  () => import('./PageContentsSidebar').then((m) => m.PageContentsSidebar),
  { ssr: false },
);

// The telemetry type per placement (the Settings row's, settings-catalogue choiceTelemetryType).
const PLACEMENT_EVENT: Record<ContentsPlacement, string> = {
  sidebar: 'ContentsPlacementSidebar',
  button: 'ContentsPlacementButton',
};
const SIDE_EVENT: Record<ContentsSide, string> = {
  left: 'ContentsSideLeft',
  right: 'ContentsSideRight',
};

export function useContentsChrome({
  props,
  chromeHidden,
  isMobile,
  closeDockPanel,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  closeDockPanel: () => void;
}): {
  // The sidebar is on screen, so the cluster has no Contents button and the corners on its side
  // make room.
  contentsDocked: boolean;
  // The side it is pinned to.
  contentsSide: ContentsSide;
  contentsSidebarEl: ReactNode;
  contentsPopoverEl: ReactNode;
} {
  const { activeDockPanel, activeDockAnchor, pagesMode, userPreferences, selfParticipant } = props;
  const toolbarScale = useUiScale('toolbar');
  const placement = readContentsPlacement(userPreferences);
  const shown = !!pagesMode && !chromeHidden && !props.zenMode;
  // A single page keeps the button: there is nothing to find your way round.
  const contentsDocked =
    shown &&
    !isMobile &&
    placement === 'sidebar' &&
    (pagesMode?.pages.length ?? 0) >= CONTENTS_SIDEBAR_MIN_PAGES;
  const contentsSide = readContentsSide(useLocalStorageValue(CONTENTS_SIDE_STORAGE_KEY));
  // The popover belongs to Pages mode's button: leaving the mode (Shift+D, a tab switch) or
  // docking the sidebar closes it rather than leaving it floating with no button under it.
  const popoverOpen = activeDockPanel === 'contents' && shown && !contentsDocked;
  useEffect(() => {
    if (activeDockPanel === 'contents' && (!pagesMode || contentsDocked)) closeDockPanel();
  }, [activeDockPanel, pagesMode, contentsDocked, closeDockPanel]);

  const ownerId = selfParticipant?.id ?? null;
  const place = useCallback(
    (next: ContentsPlacement) => {
      // Sent before the change is kept, as every settings flip is.
      track('UI', 'Changed', PLACEMENT_EVENT[next]);
      // Built on the freshest stored preferences: the write sends the whole blob.
      writeUserPreferences(withContentsPlacement(readUserPreferences(), next), ownerId);
    },
    [ownerId],
  );
  const onMinimise = useCallback(() => place('button'), [place]);
  const onMoveToSide = useCallback((side: ContentsSide) => {
    track('UI', 'Changed', SIDE_EVENT[side]);
    writeLocalStorageValue(CONTENTS_SIDE_STORAGE_KEY, side);
  }, []);
  const onDock = useCallback(() => {
    closeDockPanel();
    place('sidebar');
  }, [closeDockPanel, place]);

  if (!pagesMode) {
    return {
      contentsDocked: false,
      contentsSide,
      contentsSidebarEl: null,
      contentsPopoverEl: null,
    };
  }
  const tab: PageThumbTab = {
    id: props.activeTabId ?? '',
    name: '',
    elements: props.elements,
    pages: pagesMode.pages,
    layers: props.layers,
    font: props.tabFont,
    finish: props.tabFinish,
  };
  return {
    contentsDocked,
    contentsSide,
    contentsSidebarEl: contentsDocked ? (
      <PageContentsSidebar
        // A tab switch starts the list afresh, on the new tab's page in view.
        key={props.activeTabId ?? ''}
        view={pagesMode}
        tab={tab}
        top={toolbarTopClearancePx(toolbarScale)}
        side={contentsSide}
        onMoveToSide={onMoveToSide}
        onMinimise={onMinimise}
      />
    ) : null,
    contentsPopoverEl: popoverOpen ? (
      <PageContentsPanel
        view={pagesMode}
        tab={tab}
        anchor={activeDockAnchor ?? undefined}
        onClose={closeDockPanel}
        // A phone has no sidebar, nor does a single page.
        {...(isMobile || pagesMode.pages.length < CONTENTS_SIDEBAR_MIN_PAGES ? {} : { onDock })}
      />
    ) : null,
  };
}
