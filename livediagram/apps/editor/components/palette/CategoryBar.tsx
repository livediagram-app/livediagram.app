'use client';

import type { RefObject } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import {
  CategoryBarButtons as SharedCategoryBarButtons,
  useCategoryBar as useSharedCategoryBar,
  type CategoryBarState as SharedCategoryBarState,
} from '@liveworkspace/workbench/components/palette/CategoryBar';
import { CategoryBarFlyout as SharedCategoryBarFlyout } from '@liveworkspace/workbench/components/palette/CategoryBarFlyout';
import type { SideExtra } from '@liveworkspace/workbench/components/palette/CategoryFlyoutSide';
import {
  flyoutCategoryWidthPx,
  type FlyoutCategory,
} from '@liveworkspace/workbench/components/palette/category-flyout-kit';
import type { EditorMode } from '@livediagram/document';
import { flyoutCardColumns, flyoutLayout } from './category-flyout-groups';
import { flyoutKit } from './category-flyout-kit';
import type { PaletteTileDef } from './palette-tile-defs';
import { StripOpenedBody, Divider } from './strip-rail-items';
import { type PaletteTileActions } from './PaletteTileGrid';

// The category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): its state, its buttons, the flyout
// under it and the flyout's side panel are workbench's (@liveworkspace/workbench/components/palette/CategoryBar and
// CategoryBarFlyout), bound here to this editor's tiles (flyoutKit), its openers' bodies and its strip divider.
export {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
} from '@liveworkspace/workbench/components/palette/CategoryBar';

export type BarCategory = FlyoutCategory<PaletteTileDef> & { group?: number | undefined };

// How a category's flyout is arranged, which sets its width (the same in every mode).
const ARRANGEMENT = { layout: flyoutLayout, cardColumns: flyoutCardColumns };

/** The bar's state: which category's flyout is open, and the popover it hangs in. */
export function useCategoryBar(
  rootRef: RefObject<HTMLElement | null>,
  { onOpen }: { onOpen?: () => void } = {},
) {
  return useSharedCategoryBar<BarCategory>(rootRef, {
    onOpen,
    widthOf: (c) => flyoutCategoryWidthPx(ARRANGEMENT, c),
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
export function CategoryBarFlyout({
  mode,
  ...props
}: {
  bar: SharedCategoryBarState<BarCategory>;
  categories: readonly BarCategory[];
  mode: EditorMode;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  isMobile: boolean;
  scale: number;
}) {
  // An opener's side panel: the category it stands for, at its group (an AWS opener opens Technology's AWS marks).
  const sideExtra = (def: PaletteTileDef): SideExtra | null => {
    const a = def.action;
    if (a.type !== 'open') return null;
    const group = a.group ?? null;
    return {
      tagline: `Browse ${def.label}.`,
      body: (
        <div className="px-2 py-2.5">
          <StripOpenedBody
            opened={{ key: `${a.category}/${group ?? ''}`, category: a.category, group, label: '' }}
            content={props.categories.find((c) => c.id === a.category)?.content ?? null}
          />
        </div>
      ),
    };
  };
  return <SharedCategoryBarFlyout {...props} kit={flyoutKit(mode)} sideExtra={sideExtra} />;
}
