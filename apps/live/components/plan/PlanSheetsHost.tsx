'use client';

// Renders the open item panel or the type editor (docs/specs/026-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice: the document's boards give the status picker its names.
import { useMemo } from 'react';
import { isArchived, itemLabels } from '@livediagram/items';
import { duplicateItem } from './duplicate-item';
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
  // The type editor (docs/specs/026-plan/item-types.md "Editing a type").
  if (plan.editingTypeId && ctx.canEdit) {
    const editing =
      plan.editingTypeId === 'new' ? null : ctx.types.find((t) => t.id === plan.editingTypeId);
    if (plan.editingTypeId === 'new' || editing) {
      const ofType = editing ? [...ctx.items.values()].filter((i) => i.type === editing.id) : [];
      return (
        <ItemTypeEditor
          key={plan.editingTypeId}
          type={editing ?? null}
          types={ctx.types}
          itemCount={ofType.length}
          canDelete={ctx.types.length > 1}
          onSave={(next) => {
            ctx.itemTypes.saveType(next);
            track('Plan', editing ? 'Changed' : 'Added', 'CardType');
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
        />
      );
    }
  }
  // Every label in use, for the labels field's suggestions.
  const allLabels = [...new Set([...ctx.items.values()].flatMap((it) => itemLabels(it)))].sort();
  if (item) {
    return (
      <ItemPanel
        key={item.id}
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
        onOpenItem={(id) => ctx.openItem(id)}
        onDelete={() => ctx.deleteItem(item.id)}
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
