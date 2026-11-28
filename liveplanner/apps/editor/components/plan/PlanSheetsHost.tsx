'use client';

// Renders the open item panel or the type editor (docs/specs/026-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice: the project's boards give the status picker its names.
import { duplicateItemType, isTrashed, nextCardNumber } from '@liveplanner/items';
import { mayCreateCardType } from './may-create-card-type';
import { newTypeForBoard } from '@/hooks/plan/useTypeForBoard';
import { typeSaveAlong } from './type-save-along';
import { itemPanelProps, useItemPanelReads } from './item-panel-wiring';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { ItemPanel } from './ItemPanel';
import { ItemTypeEditor } from './ItemTypeEditor';
import { RequiredFieldsDialog } from './RequiredFieldsDialog';
import { track } from '@/lib/telemetry';
import { useCardPanelMaximised } from '@/hooks/plan/useCardPanelMaximised';

export function PlanSheetsHost({ plan }: { plan: PlanSlice }) {
  const ctx = plan.context;
  const item = plan.openItemId ? ctx.items.get(plan.openItemId) : undefined;
  // What the open card's panel reads (item-panel-wiring.ts), only while a card is open.
  const reads = useItemPanelReads(ctx, item?.id, plan.itemTrail);
  // Maximise Card (docs/specs/026-plan/plan-board.md "Maximised"): this person's preference, so every card opens
  // the way they last left one.
  const { maximised, setMaximised } = useCardPanelMaximised(ctx.ownerId);
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
      // Add Card Type from a board: only the board's statuses on (docs/specs/026-plan/plan-board.md).
      const forBoard = !editing && !from ? plan.typeForBoard : null;
      const template =
        !editing && from
          ? duplicateItemType(from, ctx.types)
          : forBoard
            ? newTypeForBoard(forBoard)
            : undefined;
      return (
        <ItemTypeEditor
          key={`${editing?.id ?? 'new'}:${plan.typeTemplateId ?? ''}:${forBoard?.boardId ?? ''}`}
          type={editing ?? null}
          {...(template ? { template } : {})}
          types={ctx.types}
          itemCount={ofType.length}
          nextNumber={nextCardNumber(ctx.items.values())}
          onSave={(next, retyped) => {
            // A field whose type changed takes its cards' values and its filters with it, all or none, in the same
            // undo step (docs/specs/026-plan/item-types.md "Edit Field").
            const along = editing ? typeSaveAlong(editing, next, retyped, ctx) : undefined;
            ctx.itemTypes.saveType(next, along);
            if (along) track('Plan', 'Changed', 'FieldType');
            // Made from a board's Add a Card menu: that board takes it.
            if (forBoard?.boardId) plan.addTypeToBoard(forBoard.boardId, next.id);
            // Made from a Gantt chart's: the chart takes it, where it names its own types.
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
  if (item) {
    return (
      <ItemPanel
        {...itemPanelProps(ctx, item, reads, plan.closeItem)}
        fresh={plan.freshItemId === item.id}
        maximised={maximised}
        onMaximise={setMaximised}
        onClose={plan.closeItem}
      />
    );
  }
  return null;
}
