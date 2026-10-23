'use client';

// A tag's own menu (docs/specs/013-workspace/tags.md "Making, renaming, recolouring and deleting"): its ⋯ (or a
// right-click on the section heading or sidebar row it sits on) opens Rename, Change Colour and Delete. Change Colour
// opens the colour picker from the same anchor; Delete asks first, saying how many designs it comes off.

import { useState } from 'react';
import type { Tag } from '@livedesign/api-schema';
import { PaletteIcon, PencilIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuHeader,
  MenuGroupSeparator,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { useDesignTags } from './DesignTagsProvider';
import { LazyTagColourPopover, LazyTagDialog } from './tag-lazy';

/** What Delete asks, naming the designs it comes off (spec "Making, renaming, recolouring and deleting"). */
export function deleteTagMessage(name: string, designs: number): string {
  const off =
    designs === 0
      ? "It isn't on any designs."
      : `It comes off its ${designs === 1 ? 'one design' : `${designs} designs`}. The designs stay.`;
  return `Delete the tag ${name}? ${off}`;
}

export function useTagActionsMenu(
  tag: Tag,
  opts: {
    onDeleted?: () => void;
    // The trigger's square, and whether it hides until its row is hovered or focused (a sidebar row).
    size?: 'md' | 'lg';
    reveal?: boolean;
  } = {},
) {
  const { updateTag, deleteTag, designsFor } = useDesignTags();
  const menu = useRowMenu();
  const [open, setOpen] = useState<'rename' | 'colour' | 'delete' | null>(null);
  const anchor = menu.triggerRef.current;
  const then = (next: 'rename' | 'colour' | 'delete') => () => {
    menu.close();
    setOpen(next);
  };
  const trigger = (
    <EllipsisTriggerButton
      {...menu.triggerProps}
      size={opts.size ?? 'lg'}
      reveal={opts.reveal}
      label={`Menu for tag ${tag.name}`}
    />
  );
  const layers = (
    <>
      {menu.open ? (
        <PortalMenu anchor={anchor} placement="below" onClose={menu.close}>
          <MenuHeader title={tag.name} />
          <MenuActionRow
            plain
            icon={<PencilIcon size={12} />}
            label="Rename"
            onClick={then('rename')}
          />
          <MenuActionRow
            plain
            icon={<PaletteIcon />}
            label="Change Colour"
            onClick={then('colour')}
          />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            icon={<TrashIcon size={12} />}
            label="Delete"
            onClick={then('delete')}
          />
        </PortalMenu>
      ) : null}
      {open === 'rename' ? <LazyTagDialog tag={tag} onClose={() => setOpen(null)} /> : null}
      {open === 'colour' && anchor ? (
        <LazyTagColourPopover
          name={tag.name}
          colour={tag.colour}
          anchor={anchor}
          onPick={(colour) => updateTag(tag.id, { colour })}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'delete' && anchor ? (
        <ConfirmPopover
          anchor={anchor}
          message={deleteTagMessage(tag.name, designsFor(tag.id).size)}
          confirmLabel="Delete Tag"
          onConfirm={() => {
            setOpen(null);
            deleteTag(tag.id);
            opts.onDeleted?.();
          }}
          onCancel={() => setOpen(null)}
        />
      ) : null}
    </>
  );
  return { trigger, layers, onContextMenu: menu.onContextMenu };
}
