'use client';

import type { RefObject } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import {
  CategoryBarButtons as SharedCategoryBarButtons,
  useCategoryBar as useSharedCategoryBar,
  type CategoryBarState as SharedCategoryBarState,
} from '@liveworkspace/workbench/components/palette/CategoryBar';
import { CategoryBarFlyout as SharedCategoryBarFlyout } from '@liveworkspace/workbench/components/palette/CategoryBarFlyout';
import {
  flyoutCategoryWidthPx,
  type FlyoutCategory,
} from '@liveworkspace/workbench/components/palette/category-flyout-kit';
import type { PaletteTileDef } from './palette-tile-defs';
import { FLYOUT_KIT } from './category-flyout-kit';
import { Divider } from './strip-rail-items';
import { type PaletteTileActions } from './PaletteTileGrid';

// The category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): its state, its buttons, the flyout
// under it and the flyout's side panel are workbench's (@liveworkspace/workbench/components/palette/CategoryBar and
// CategoryBarFlyout), bound here to this editor's tiles (FLYOUT_KIT) and strip divider.
export {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
} from '@liveworkspace/workbench/components/palette/CategoryBar';

// A category with `width` lays out its own body (the avatar palette's) at that width; else the width follows its tiles.
export type BarCategory = FlyoutCategory<PaletteTileDef> & { group?: number | undefined };

/** The bar's state: which category's flyout is open, and the popover it hangs in. */
export function useCategoryBar(
  rootRef: RefObject<HTMLElement | null>,
  { onOpen }: { onOpen?: () => void } = {},
) {
  return useSharedCategoryBar<BarCategory>(rootRef, {
    onOpen,
    widthOf: (c) => flyoutCategoryWidthPx(FLYOUT_KIT, c),
  });
}

/** The bar's buttons, a divider between the bands. */
export function CategoryBarButtons(
  props: Omit<
    Parameters<typeof SharedCategoryBarButtons<BarCategory>>[0],
    'divider' | 'tourAnchors'
  >,
) {
  return <SharedCategoryBarButtons {...props} divider={<Divider />} />;
}

/** The open category's flyout and its side panel, drawn from this editor's tiles. */
export function CategoryBarFlyout(props: {
  bar: SharedCategoryBarState<BarCategory>;
  categories: readonly BarCategory[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  isMobile: boolean;
  scale: number;
}) {
  return <SharedCategoryBarFlyout {...props} kit={FLYOUT_KIT} />;
}
