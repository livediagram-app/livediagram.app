'use client';

import { Fragment, useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { CatalogueGroupTile, type StripGroup, type StripOpen } from './catalogue-strip-groups';
import { BrowseStartGroup } from './PaletteCategoryBrowser';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';
import type { PaletteTileDef } from './palette-tile-defs';
import { STRIP_DIVIDER_ATTR } from './useEdgeDividers';
import type { useStripPopover } from './ToolbarStripPopover';

// The Toolbar strip's rail items and the popover a group or opener opens (docs/specs/007-editor/toolbar-layout.md
// "More"), kept out of ToolbarPalette: a catalogue's groups, or a category's tiles with its openers
// (palette-openers) and fixed dividers.

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

/** A catalogue's groups, each opening its entries. `openers` absent draws them inert (a category leaving). */
export function groupItems(
  categoryId: string,
  groups: StripGroup[],
  openers?: Openers,
): ReactNode[] {
  return groups.map((g) => (
    <CatalogueGroupTile
      key={g.id}
      group={g}
      open={openers?.isOpen(g.id) ?? false}
      onToggle={(anchor) =>
        openers?.toggleOpen(
          { key: g.id, category: categoryId, group: g.id, label: g.label },
          anchor,
        )
      }
    />
  ));
}

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
    const a = def.action;
    const tile =
      a.type === 'open' ? (
        <CatalogueGroupTile
          group={{ id: def.id, label: def.label, icon: def.icon }}
          open={openers?.isOpen(def.id) ?? false}
          onToggle={(anchor) =>
            openers?.toggleOpen(
              { key: def.id, category: a.category, group: a.group ?? null, label: def.label },
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

/** The More popover's body: the category's own, or the category (or catalogue group, alone) a tile opened. */
export function StripOpenedBody({
  opened,
  content,
}: {
  opened: StripOpen | null;
  // The body of the category it shows (`opened.category`, else the strip's own).
  content: ReactNode;
}) {
  return (
    <BrowseStartGroup.Provider value={opened?.group ? { id: opened.group, bare: true } : null}>
      {/* Keyed on what opened it, so another group's tile opens the body afresh on its own. */}
      <Fragment key={opened?.key ?? ''}>{content}</Fragment>
    </BrowseStartGroup.Provider>
  );
}
