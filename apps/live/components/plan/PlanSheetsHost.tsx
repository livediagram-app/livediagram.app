'use client';

// Renders the open item panel or the type editor (docs/specs/026-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice: the document's boards give the status picker its names.
import { useMemo } from 'react';
import {
  ITEM_TYPES_MAX,
  PARENT_FIELD,
  duplicateItemType,
  isArchived,
  itemLabels,
  linkedCardsOf,
  newItemId,
  typeAllowsStatus,
  typeIn,
} from '@livediagram/items';
import { duplicateItem } from './duplicate-item';
import { liveTrail } from './item-trail';
import { toggleFlag } from './item-flag';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { ItemPanel } from './ItemPanel';
import { ItemTypeEditor } from './ItemTypeEditor';
import { track } from '@/lib/telemetry';

export function PlanSheetsHost({ plan }: { plan: PlanSlice }) {
  const ctx = plan.context;
  // Every column of the document, the open tab's first (docs/specs/026-plan/plan-templates.md "Hand-offs").
  const statuses = useMemo(
    () => [...ctx.statusNames].map(([status, name]) => ({ status, name })),
    [ctx.statusNames],
  );
  const projects = useMemo(
    () => [...ctx.items.values()].filter((i) => i.type === 'project').sort((a, b) => a.key - b.key),
    [ctx.items],
  );
  const item = plan.openItemId ? ctx.items.get(plan.openItemId) : undefined;
  // The open card's trail and children (docs/specs/026-plan/plan-board.md "Open an item"): one pass over the
  // items, only while a card is open, and only again when the items or the open card change.
  const openId = item?.id;
  const trail = useMemo(
    () => (openId ? liveTrail(plan.itemTrail, openId, ctx.items) : []),
    [plan.itemTrail, openId, ctx.items],
  );
  // The cards linking to the open one (docs/specs/026-plan/item-types.md "Card fields"): its Parent children (a
  // Project's Child Cards) and a group per Card field that links to its type, from one helper.
  const linked = useMemo(() => {
    const open = openId ? ctx.items.get(openId) : undefined;
    return open ? linkedCardsOf(open, ctx.items, ctx.types) : [];
  }, [openId, ctx.items, ctx.types]);
  const childCards = useMemo(
    () => linked.find((g) => g.fieldId === PARENT_FIELD)?.cards ?? [],
    [linked],
  );
  const linkedGroups = useMemo(() => linked.filter((g) => g.fieldId !== PARENT_FIELD), [linked]);
  // The type editor (docs/specs/026-plan/item-types.md "Editing a type").
  if (plan.editingTypeId && ctx.canEdit) {
    const editing =
      plan.editingTypeId === 'new' ? null : ctx.types.find((t) => t.id === plan.editingTypeId);
    if (plan.editingTypeId === 'new' || editing) {
      const ofType = editing ? [...ctx.items.values()].filter((i) => i.type === editing.id) : [];
      // Duplicate: a new type filled from another (docs/specs/026-plan/item-types.md "The Card Types panel").
      const from = plan.typeTemplateId
        ? ctx.types.find((t) => t.id === plan.typeTemplateId)
        : undefined;
      const template = !editing && from ? duplicateItemType(from, ctx.types) : undefined;
      return (
        <ItemTypeEditor
          key={`${plan.editingTypeId}:${plan.typeTemplateId ?? ''}`}
          type={editing ?? null}
          {...(template ? { template } : {})}
          types={ctx.types}
          itemCount={ofType.length}
          canDelete={ctx.types.length > 1}
          onSave={(next) => {
            ctx.itemTypes.saveType(next);
            track('Plan', editing ? 'Changed' : template ? 'Duplicated' : 'Added', 'CardType');
            plan.closeTypeEditor();
          }}
          onDelete={(moveTo) => {
            if (!editing) return;
            if (moveTo) for (const it of ofType) ctx.patchItem(it.id, { type: moveTo });
            ctx.itemTypes.deleteType(editing.id);
            track('Plan', 'Deleted', 'CardType');
            ctx.announce(`${editing.label} deleted`);
            plan.closeTypeEditor();
          }}
          onClose={plan.closeTypeEditor}
          {...(editing && ctx.types.length < ITEM_TYPES_MAX
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
        projects={projects}
        people={ctx.people}
        labels={allLabels}
        canEdit={ctx.canEdit}
        onSave={(field, value) =>
          ctx.patchItem(
            item.id,
            value === undefined ? { clear: [field] } : { set: { [field]: value } },
          )
        }
        onPatch={(patch) => ctx.patchItem(item.id, patch)}
        onType={(type) => ctx.patchItem(item.id, { type })}
        onOpenItem={(id, via) => ctx.openItem(id, via)}
        fresh={plan.freshItemId === item.id}
        trail={trail}
        childCards={childCards}
        linkedGroups={linkedGroups}
        onAddLinked={(group, typeId) => {
          // A new card of that type, already linked here, in the first status its type uses; opened next.
          const type = typeIn(ctx.types, typeId);
          const status =
            [...ctx.statusNames.keys()].find((st) => typeAllowsStatus(type, st)) ?? 'todo';
          const id = newItemId();
          ctx.addItem({
            type: typeId,
            fields: { title: type.newTitle, [group.fieldId]: item.id },
            status,
            after: null,
            id,
          });
          ctx.openNewItem(id, 'ChildCard');
          track('Plan', 'Added', 'LinkedCard');
        }}
        statusNames={ctx.statusNames}
        onTrash={() => {
          ctx.trashItem(item.id);
          ctx.announce('Card moved to the Trash');
        }}
        onDuplicate={() => duplicateItem(ctx, item)}
        onFlag={() => toggleFlag(ctx, item)}
        onArchive={() => {
          const was = isArchived(item);
          ctx.patchItem(item.id, was ? { clear: ['archived'] } : { set: { archived: true } });
          ctx.announce(was ? 'Card restored' : 'Card archived');
          if (was) track('Plan', 'Restored', 'Card');
          else track('Plan', 'Moved', 'Archive');
        }}
        onClose={plan.closeItem}
        comments={{
          canComment: ctx.canVote,
          selfId: ctx.ownerId,
          onComment: (action) => ctx.commentItem(item.id, action),
        }}
      />
    );
  }
  return null;
}
