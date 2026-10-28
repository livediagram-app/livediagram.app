'use client';

// Renders the open item panel or the type editor (docs/specs/026-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice: the project's boards give the status picker its names.
import { useMemo } from 'react';
import {
  duplicateItemType,
  isArchived,
  isTrashed,
  itemLabels,
  linkedCardsOf,
  newItemId,
  requiredFieldEmptied,
  typeIn,
} from '@liveplanner/items';
import { duplicateItem } from './duplicate-item';
import { mayCreateCardType } from './may-create-card-type';
import { newCardStatus } from './new-card-status';
import { newTypeForBoard } from '@/hooks/plan/useTypeForBoard';
import { liveTrail } from './item-trail';
import { toggleFlag } from './item-flag';
import { linkExistingCard } from './link-existing';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { ItemPanel } from './ItemPanel';
import { ItemTypeEditor } from './ItemTypeEditor';
import { RequiredFieldsDialog } from './RequiredFieldsDialog';
import { track } from '@/lib/telemetry';

export function PlanSheetsHost({ plan }: { plan: PlanSlice }) {
  const ctx = plan.context;
  // Every column of the project, the open tab's first (docs/specs/026-plan/plan-templates.md "Hand-offs").
  const statuses = useMemo(
    () => [...ctx.statusNames].map(([status, name]) => ({ status, name })),
    [ctx.statusNames],
  );
  const item = plan.openItemId ? ctx.items.get(plan.openItemId) : undefined;
  // The open card's trail and children (docs/specs/026-plan/plan-board.md "Open an item"): one pass over the
  // items, only while a card is open, and only again when the items or the open card change.
  const openId = item?.id;
  const trail = useMemo(
    () => (openId ? liveTrail(plan.itemTrail, openId, ctx.items) : []),
    [plan.itemTrail, openId, ctx.items],
  );
  // The cards linking to the open one (docs/specs/026-plan/item-types.md "Card fields"): a group per Card field
  // that links to its type (a Project's Linked as Parent among them), from one helper.
  const linkedGroups = useMemo(() => {
    const open = openId ? ctx.items.get(openId) : undefined;
    return open ? linkedCardsOf(open, ctx.items, ctx.types) : [];
  }, [openId, ctx.items, ctx.types]);
  // A new card waiting for its required fields comes first (docs/specs/026-plan/item-types.md "Required fields"):
  // the panel of a card opened as it was asked for shows once it is made.
  if (plan.requiredFields) {
    return (
      <RequiredFieldsDialog request={plan.requiredFields} onDone={plan.settleRequiredFields} />
    );
  }
  // The type editor (docs/specs/026-plan/item-types.md "Editing a type").
  const target = plan.editingType;
  if (target && ctx.canEdit) {
    const editing = target === 'new' ? null : ctx.types.find((t) => t.id === target.id);
    if (target === 'new' || editing) {
      // The type's cards out of the Trash: a delete moves them there with it.
      const ofType = editing
        ? [...ctx.items.values()].filter((i) => i.type === editing.id && !isTrashed(i))
        : [];
      // Duplicate: a new type filled from another (docs/specs/026-plan/item-types.md "The Card Types panel").
      const from = plan.typeTemplateId
        ? ctx.types.find((t) => t.id === plan.typeTemplateId)
        : undefined;
      // Add New Card Type from a board: only the board's statuses on (docs/specs/026-plan/plan-board.md).
      const forBoard = !editing && !from ? plan.typeForBoard : null;
      const template =
        !editing && from
          ? duplicateItemType(from, ctx.types)
          : forBoard
            ? newTypeForBoard(forBoard, ctx.statusNames.keys())
            : undefined;
      return (
        <ItemTypeEditor
          key={`${editing?.id ?? 'new'}:${plan.typeTemplateId ?? ''}:${forBoard?.boardId ?? ''}`}
          type={editing ?? null}
          {...(template ? { template } : {})}
          types={ctx.types}
          itemCount={ofType.length}
          onSave={(next) => {
            ctx.itemTypes.saveType(next);
            // Made from a board's Add a Card menu: that board takes it.
            if (forBoard?.boardId) plan.addTypeToBoard(forBoard.boardId, next.id);
            // Made from a Gantt chart's: the chart takes it, where it names its own types.
            if (forBoard?.viewId) plan.addTypeToView(forBoard.viewId, next.id);
            track('Plan', editing ? 'Changed' : from ? 'Duplicated' : 'Added', 'CardType');
            plan.closeTypeEditor();
          }}
          onDelete={() => {
            if (!editing) return;
            ctx.trashItems(ofType.map((it) => it.id));
            ctx.itemTypes.deleteType(editing.id);
            track('Plan', 'Deleted', 'CardType');
            ctx.announce(`${editing.label} deleted`);
            plan.closeTypeEditor();
          }}
          onClose={plan.closeTypeEditor}
          {...(editing && mayCreateCardType(ctx)
            ? { onDuplicate: () => ctx.editType('new', editing.id) }
            : {})}
        />
      );
    }
  }
  // Every label in use, for the labels field's suggestions.
  const allLabels = [...new Set([...ctx.items.values()].flatMap((it) => itemLabels(it)))].sort();
  if (item) {
    return (
      <ItemPanel
        item={item}
        types={ctx.types}
        statuses={statuses}
        people={ctx.people}
        labels={allLabels}
        canEdit={ctx.canEditCards}
        canRetire={ctx.canEdit}
        onSave={(field, value) => {
          // A required field is never emptied (docs/specs/026-plan/item-types.md "Required fields"): said by name,
          // and the field goes back to its value.
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
        }}
        onPatch={(patch) => void ctx.patchItem(item.id, patch)}
        onType={(type) => void ctx.patchItem(item.id, { type })}
        onOpenItem={(id, via) => ctx.openItem(id, via)}
        fresh={plan.freshItemId === item.id}
        trail={trail}
        linkedGroups={linkedGroups}
        onAddLinked={(group, typeId) => {
          // A new card of that type, already linked here, in its type's Default State (its own, else its built-in
          // one by name), else the first status its type uses; opened next.
          const type = typeIn(ctx.types, typeId);
          const status = newCardStatus(type, ctx.statusNames);
          const id = newItemId();
          void ctx.addItem({
            type: typeId,
            fields: { title: type.newTitle, [group.fieldId]: item.id },
            status,
            after: null,
            id,
          });
          ctx.openNewItem(id, 'ChildCard');
          track('Plan', 'Added', 'LinkedCard');
        }}
        onLinkExisting={(group, cardId, moved) => linkExistingCard(ctx, item, group, cardId, moved)}
        statusNames={ctx.statusNames}
        {...(ctx.linkedActions ? { linkedActions: ctx.linkedActions } : {})}
        onTrash={() => {
          ctx.trashItem(item.id);
          ctx.announce('Card moved to the Trash');
        }}
        onDuplicate={() => duplicateItem(ctx, item)}
        onFlag={() => toggleFlag(ctx, item)}
        onArchive={() => {
          const was = isArchived(item);
          void ctx.patchItem(item.id, was ? { clear: ['archived'] } : { set: { archived: true } });
          ctx.announce(was ? 'Card restored' : 'Card archived');
          if (was) track('Plan', 'Restored', 'Card');
          else track('Plan', 'Moved', 'Archive');
        }}
        onClose={plan.closeItem}
        onEditType={() => {
          plan.closeItem();
          ctx.editType({ id: item.type });
        }}
      />
    );
  }
  return null;
}
