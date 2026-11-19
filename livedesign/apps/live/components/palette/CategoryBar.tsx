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
import type { PaletteTileDef } from './palette-tile-defs';
import { FLYOUT_KIT } from './category-flyout-kit';
import { StripOpenedBody, Divider } from './strip-rail-items';
import { FillColourPicker } from './FillToolRow';
import { tileHandler, type PaletteTileActions } from './PaletteTileGrid';

// The category bar (docs/specs/007-editor/toolbar-layout.md "The category bar"): its state, its buttons, the flyout
// under it and the flyout's side panel are workbench's (@liveworkspace/workbench/components/palette/CategoryBar and
// CategoryBarFlyout), bound here to this editor's tiles (FLYOUT_KIT) and strip divider, and to what a side panel holds
// for an opener and the Fill tool.
export {
  HOVER_CLOSE_MS,
  HOVER_OPEN_MS,
} from '@liveworkspace/workbench/components/palette/CategoryBar';

export type BarCategory = FlyoutCategory<PaletteTileDef> & { group?: number | undefined };

const FILL_HINT = 'Pick a colour to pick the bucket up in it.';

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
export function CategoryBarFlyout({
  bar,
  categories,
  actions,
  pendingDraw,
  isMobile,
  scale,
}: {
  bar: SharedCategoryBarState<BarCategory>;
  categories: readonly BarCategory[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  isMobile: boolean;
  scale: number;
}) {
  // What a side panel holds for an opener (the category it stands for, at its group: an AWS opener opens
  // Technology's AWS marks) and for the Fill tool (its one colour picker; a pick picks the bucket up in it, closing
  // the flyout as any tool does).
  const sideExtra = (def: PaletteTileDef): SideExtra | null => {
    const a = def.action;
    if (a.type === 'open') {
      const group = a.group ?? null;
      return {
        tagline: `Browse ${def.label}.`,
        body: (
          <div className="px-2 py-2.5">
            <StripOpenedBody
              opened={{
                key: `${a.category}/${group ?? ''}`,
                category: a.category,
                group,
                label: '',
              }}
              content={categories.find((c) => c.id === a.category)?.content ?? null}
            />
          </div>
        ),
      };
    }
    if (a.type === 'fill')
      return {
        tagline: FILL_HINT,
        body: (
          <div className="px-3 py-2.5">
            <FillColourPicker onPick={(fill) => actions.beginFill?.(fill)} />
          </div>
        ),
      };
    return null;
  };
  // The Fill tool picks up (or puts down) at a press, as any tool; its colour is in the panel resting on it opens. A
  // phone cannot rest, so there a tap opens the panel, and a colour picks it up.
  const pressSide = (def: PaletteTileDef): boolean => {
    if (def.action.type !== 'fill' || isMobile) return false;
    tileHandler(def, actions, pendingDraw)();
    return true;
  };
  return (
    <SharedCategoryBarFlyout
      bar={bar}
      categories={categories}
      kit={FLYOUT_KIT}
      actions={actions}
      pendingDraw={pendingDraw}
      isMobile={isMobile}
      scale={scale}
      sideExtra={sideExtra}
      pressSide={pressSide}
    />
  );
}
