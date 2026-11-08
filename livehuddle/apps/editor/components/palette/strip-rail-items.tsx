'use client';

import { Fragment, useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { CatalogueGroupTile, type StripOpen } from './catalogue-strip-groups';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';
import type { PaletteTileDef } from './palette-tile-defs';
import { STRIP_DIVIDER_ATTR } from '@liveworkspace/workbench/components/palette/useEdgeDividers';
import type { useStripPopover } from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';

// The Toolbar strip's rail items and the popover a group or opener opens (docs/specs/007-editor/toolbar-layout.md
// "More"), kept out of ToolbarPalette: a catalogue's groups, or a category's tiles with its openers
// and fixed dividers.

// What a tile's presets popover says under its name when the tile says nothing of its own.
const PRESETS_DESCRIPTION = 'Start from a preset, then change any of it.';

export function Divider() {
  // Hairline margins on a phone, where every pixel of the strip is a tile's.
  return (
    <span
      aria-hidden
      {...{ [STRIP_DIVIDER_ATTR]: '' }}
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 phone:mx-px dark:bg-slate-700"
    />
  );
}

/** What the strip's More popover is showing: More's own body (`opened` null), or what a group tile or an opener
 *  opened. A tile pressed again closes it. */
export function useStripOpeners(more: ReturnType<typeof useStripPopover>) {
  const [opened, setOpened] = useState<StripOpen | null>(null);
  const isOpen = (key: string) => more.open && opened?.key === key;
  return {
    opened,
    // More's own popover, not a group's.
    moreShown: more.open && opened === null,
    isOpen,
    openMore: (button: HTMLElement) => {
      track('UI', 'Opened', 'ToolbarMore');
      setOpened(null);
      more.openFrom(button);
    },
    toggleOpen: (next: StripOpen, anchor: HTMLElement) => {
      if (isOpen(next.key)) return more.setOpen(false);
      track('UI', 'Opened', 'ToolbarMore');
      setOpened(next);
      // Centred under its tile (More hangs from its own button's right edge).
      more.openFrom(anchor, 'centre');
    },
  };
}

type Openers = ReturnType<typeof useStripOpeners>;

/** A category's tiles, an opener drawn as one and a fixed divider riding with the tile it follows. `openers` absent
 *  draws them inert (a category leaving). */
export function tileItems(
  tiles: PaletteTileDef[],
  dividersAfter: ReadonlySet<string>,
  actions: PaletteTileActions,
  pendingDraw: PendingDraw | null,
  openers?: Openers,
): ReactNode[] {
  return tiles.map((def) => {
    // A tile with presets opens them (docs/specs/009-elements/card.md "Card presets"), as a catalogue's group does.
    const variants = def.variants;
    const tile =
      variants && variants.length > 0 ? (
        <CatalogueGroupTile
          group={{ id: def.id, label: def.caption ?? def.label, icon: def.icon }}
          open={openers?.isOpen(def.id) ?? false}
          onToggle={(anchor) =>
            openers?.toggleOpen(
              {
                key: def.id,
                category: def.section,
                group: null,
                label: def.caption ?? def.label,
                variants: { description: def.variantsHint ?? PRESETS_DESCRIPTION, tiles: variants },
              },
              anchor,
            )
          }
        />
      ) : (
        <PaletteTile def={def} actions={actions} pendingDraw={pendingDraw} compact />
      );
    return dividersAfter.has(def.id) ? (
      <span key={def.id} className="flex items-center">
        {tile}
        <Divider />
      </span>
    ) : (
      <Fragment key={def.id}>{tile}</Fragment>
    );
  });
}
