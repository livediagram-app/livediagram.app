'use client';

// The card panel's wiring from the Plan context (docs/specs/026-plan/plan-board.md "Open an item"): what it reads
// (statuses, trail, linked cards, labels) and every write it makes, shared by the floating panel a board opens
// (PlanSheetsHost) and the panel a Session tab embeds (session/SessionCard, docs/specs/026-plan/session-tabs.md
// "The card"), so a card is worked on the same way in both.
import { useMemo } from 'react';
import {
  isArchived,
  itemTitle,
  labelUsage,
  linkedCardsOf,
  newItemId,
  requiredFieldEmptied,
  typeIn,
  type Item,
} from '@liveplanner/items';
import { duplicateItem } from './duplicate-item';
import { copyCardLink } from './copy-card-link';
import { newCardStatus } from './new-card-status';
import { liveTrail } from './item-trail';
import { toggleFlag } from './item-flag';
import { linkExistingCard } from './link-existing';
import type { PlanContextValue } from './PlanContext';
import type { ItemPanelProps } from './ItemPanel';
import { track } from '@/lib/telemetry';

// What the panel reads for the card `openId`: one pass over the items each, only while a card is shown, and again
// only when the items or the card change, never per keystroke.
export function useItemPanelReads(
  ctx: PlanContextValue,
  openId: string | undefined,
  itemTrail: readonly string[],
) {
  // Every column of the project, the open tab's first (docs/specs/026-plan/plan-templates.md "Hand-offs").
  const statuses = useMemo(
    () => [...ctx.statusNames].map(([status, name]) => ({ status, name })),
    [ctx.statusNames],
  );
  // The card's trail (docs/specs/026-plan/plan-board.md "Breadcrumb").
  const trail = useMemo(
    () => (openId ? liveTrail(itemTrail, openId, ctx.items) : []),
    [itemTrail, openId, ctx.items],
  );
  // The cards linking to it (docs/specs/026-plan/item-types.md "Card fields"): a group per Card field.
  const linkedGroups = useMemo(() => {
    const open = openId ? ctx.items.get(openId) : undefined;
    return open ? linkedCardsOf(open, ctx.items, ctx.types) : [];
  }, [openId, ctx.items, ctx.types]);
  // The plan's labels with their counts, for the Labels field's menu.
  const labels = useMemo(() => (openId ? labelUsage(ctx.items.values()) : []), [openId, ctx.items]);
  return { statuses, trail, linkedGroups, labels };
}

export type ItemPanelReads = ReturnType<typeof useItemPanelReads>;

// The panel's props for `item`, but for how it opens and closes (its caller's).
export function itemPanelProps(
  ctx: PlanContextValue,
  item: Item,
  reads: ItemPanelReads,
  closeItem: () => void,
): Omit<ItemPanelProps, 'onClose' | 'fresh' | 'maximised' | 'onMaximise'> {
  const linkOf = ctx.cardLink;
  return {
    item,
    types: ctx.types,
    statusTypes: ctx.statusTypes,
    statuses: reads.statuses,
    people: ctx.people,
    labels: reads.labels,
    canEdit: ctx.canEditCards,
    canRetire: ctx.canEdit,
    onSave: (field, value) => {
      // A required field is never emptied (docs/specs/026-plan/item-types.md "Required fields"): said by name, and
      // the field goes back to its value.
      const type = typeIn(ctx.types, item.type);
      const emptied = requiredFieldEmptied(type, item.fields, field, value);
      if (emptied) {
        const message = `${emptied.label} is required on ${type.label} cards`;
        ctx.notify?.(message);
        ctx.announce(message);
        return Promise.resolve(false);
      }
      return ctx.patchItem(
        item.id,
        value === undefined ? { clear: [field] } : { set: { [field]: value } },
      );
    },
    onPatch: (patch) => void ctx.patchItem(item.id, patch),
    onType: (type) => void ctx.patchItem(item.id, { type }),
    onOpenItem: (id, via) => ctx.openItem(id, via),
    trail: reads.trail,
    linkedGroups: reads.linkedGroups,
    onAddLinked: (group, typeId, start) => {
      // A new card of that type, already linked here, in its type's Default State, else the first status its type
      // uses; opened next. A template's values (`start`) under the link.
      const type = typeIn(ctx.types, typeId);
      const status = newCardStatus(type, ctx.statusNames);
      const id = newItemId();
      void ctx.addItem({
        type: typeId,
        fields: {
          title: type.newTitle,
          ...start,
          [group.fieldId]: group.several ? [item.id] : item.id,
        },
        status,
        after: null,
        id,
      });
      ctx.openNewItem(id, 'ChildCard');
      track('Plan', 'Added', 'LinkedCard');
    },
    onLinkExisting: (group, cardId, moved) => linkExistingCard(ctx, item, group, cardId, moved),
    statusNames: ctx.statusNames,
    ...(ctx.linkedActions ? { linkedActions: ctx.linkedActions } : {}),
    onTrash: () => {
      ctx.trashItem(item.id);
      ctx.announce('Card moved to the Trash');
    },
    onDuplicate: () => duplicateItem(ctx, item),
    onFlag: () => toggleFlag(ctx, item),
    onArchive: () => {
      const was = isArchived(item);
      void ctx.patchItem(item.id, was ? { clear: ['archived'] } : { set: { archived: true } });
      ctx.announce(was ? 'Card restored' : 'Card archived');
      if (was) track('Plan', 'Restored', 'Card');
      else track('Plan', 'Moved', 'Archive');
    },
    ...(linkOf
      ? { onCopyLink: () => copyCardLink(linkOf(item.id), ctx.notify, itemTitle(item)) }
      : {}),
    onEditType: () => {
      closeItem();
      ctx.editType({ id: item.type });
    },
  };
}
