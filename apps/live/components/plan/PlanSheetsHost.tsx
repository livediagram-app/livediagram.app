'use client';

// Renders the open item panel or board set-up (docs/specs/025-plan/plan-board.md) beside the canvas,
// from the editor's Plan slice and the active tab: the tab's boards give the status picker its names
// and the set-up its board.
import { useMemo } from 'react';
import type { Element } from '@livediagram/document';
import { normaliseBoardSetup, type PlanBoardSetup } from '@livediagram/items';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { ItemPanel } from './ItemPanel';
import { ItemTypeEditor } from './ItemTypeEditor';
import { track } from '@/lib/telemetry';

function boardsOf(elements: readonly Element[]): { id: string; setup: PlanBoardSetup }[] {
  return elements.flatMap((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board') return [];
    const setup = normaliseBoardSetup(el.planBoard);
    return setup ? [{ id: el.id, setup }] : [];
  });
}

export function PlanSheetsHost({
  plan,
  elements,
}: {
  plan: PlanSlice;
  elements: readonly Element[];
}) {
  const ctx = plan.context;
  const boards = useMemo(() => boardsOf(elements), [elements]);
  const statuses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of boards)
      for (const c of b.setup.columns) if (!seen.has(c.status)) seen.set(c.status, c.name);
    return [...seen].map(([status, name]) => ({ status, name }));
  }, [boards]);
  const projects = useMemo(
    () => [...ctx.items.values()].filter((i) => i.type === 'project').sort((a, b) => a.key - b.key),
    [ctx.items],
  );
  const item = plan.openItemId ? ctx.items.get(plan.openItemId) : undefined;
  // The type editor (docs/specs/025-plan/item-types.md "Editing a type").
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
  if (item) {
    return (
      <ItemPanel
        key={item.id}
        item={item}
        types={ctx.types}
        statuses={statuses}
        projects={projects}
        people={ctx.people}
        canEdit={ctx.canEdit}
        onSave={(field, value) =>
          ctx.patchItem(
            item.id,
            value === undefined ? { clear: [field] } : { set: { [field]: value } },
          )
        }
        onPatch={(patch) => ctx.patchItem(item.id, patch)}
        onType={(type) => ctx.patchItem(item.id, { type })}
        onDelete={() => ctx.deleteItem(item.id)}
        onClose={plan.closeItem}
      />
    );
  }
  return null;
}
