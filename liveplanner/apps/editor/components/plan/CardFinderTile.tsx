'use client';

// One tile of the Cards panel (docs/specs/026-plan/items.md "Finding a card"): the card as a board draws it at
// Detailed size, with its ⋯ inside the card at the end of its header row, never beside it. The whole tile opens the
// card (a stretched button under the face, so the ⋯ is not nested in it); the ⋯ opens Open, Copy Card Link and, for
// someone who may retire cards, Move to Trash. With a mouse the ⋯ shows on hover or focus; on touch, always.
import { useState, type SyntheticEvent } from 'react';
import { CARD_FIELDS, itemTitle, type Item, type ItemTypeDef } from '@liveplanner/items';
import { TrashIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideArrowUpRight, lucideLink } from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { PlanCardFace } from './PlanCardFace';
import type { PlanPalette } from './plan-palette';

const OpenIcon = lucideGlyph(lucideArrowUpRight, 14);
const LinkIcon = lucideGlyph(lucideLink, 14);
const stopPress = (e: SyntheticEvent) => e.stopPropagation();

export function CardFinderTile({
  item,
  type,
  palette,
  canRetire,
  onOpen,
  onTrash,
  onCopyLink,
}: {
  item: Item;
  type: ItemTypeDef;
  palette: PlanPalette;
  // Move to Trash is an Editor's (docs/specs/013-workspace/share-roles.md), as the item panel's Trash.
  canRetire: boolean;
  onOpen: () => void;
  onTrash: () => void;
  // Copies the card's address; absent (no address to give, as in an embed), no row.
  onCopyLink?: (() => void) | undefined;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };
  return (
    <li className="group relative flex">
      {/* First, so Tab reaches the card before its ⋯. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${itemTitle(item) || 'Untitled'}, ${type.label} #${item.key}`}
        className="absolute inset-0 z-[1] cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      />
      {/* The card itself, its frame taking the tile's height so a row of tiles lines up. A soft shadow rises on
          hover, as a board's card lifts (a transform here would lift the face over its own ⋯). */}
      <div className="flex min-w-0 flex-1 rounded-xl transition-shadow duration-150 group-hover:shadow-md motion-reduce:transition-none">
        <div className="min-w-0 flex-1">
          <PlanCardFace
            item={item}
            palette={palette}
            fields={CARD_FIELDS}
            size="detailed"
            headAction={
              // Above the stretched Open button, so it takes its own presses.
              <span className="relative z-[2] -my-0.5 -mr-1 flex">
                <EllipsisTriggerButton
                  ref={setTrigger}
                  size="md"
                  reveal
                  label={`More for #${item.key}`}
                  expanded={menuOpen}
                  // Shown too while the tile's Open has keyboard focus, so the next Tab lands on something visible.
                  className="pointer-fine:group-focus-within:opacity-100"
                  onClick={() => setMenuOpen((v) => !v)}
                />
              </span>
            }
          />
        </div>
      </div>
      {menuOpen ? (
        // A portal's presses still bubble up the React tree to the canvas under the panel; they stop here.
        <div className="contents" onPointerDown={stopPress}>
          <PortalMenu anchor={trigger} placement="below" onClose={() => setMenuOpen(false)}>
            <MenuActionRow plain label="Open" icon={<OpenIcon />} onClick={run(onOpen)} />
            {onCopyLink ? (
              <MenuActionRow
                plain
                label="Copy Card Link"
                icon={<LinkIcon />}
                onClick={run(onCopyLink)}
              />
            ) : null}
            {canRetire ? (
              <>
                <MenuGroupSeparator />
                <MenuActionRow
                  plain
                  label="Move to Trash"
                  icon={<TrashIcon />}
                  onClick={run(onTrash)}
                />
              </>
            ) : null}
          </PortalMenu>
        </div>
      ) : null}
    </li>
  );
}
