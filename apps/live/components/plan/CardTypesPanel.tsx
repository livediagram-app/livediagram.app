'use client';

// The Card Types panel (docs/specs/025-plan/item-types.md "The Card Types panel"): the document's item
// types, each with its glyph and colour, its name and how many items have it. A popover hanging above
// its button in Plan mode's bottom-right cluster. Edit and Add Type open the type editor; rows reorder
// by drag, or Alt with the arrow keys; Restore Built-In Types puts the built-ins back. Someone who
// may only view sees the list.
import { useMemo, useState } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';

export function CardTypesPanel({
  popoverOpen,
  popoverAnchor,
  onPopoverClose,
}: {
  popoverOpen: boolean;
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const confirm = useConfirm();
  const [dragging, setDragging] = useState<string | null>(null);
  const counts = useMemo(() => {
    const n = new Map<string, number>();
    for (const it of plan?.items.values() ?? []) n.set(it.type, (n.get(it.type) ?? 0) + 1);
    return n;
  }, [plan?.items]);
  if (!plan) return null;
  const { types, canEdit, itemTypes } = plan;
  const ids = types.map((t) => t.id);

  const moveTo = (id: string, to: number) => {
    const from = ids.indexOf(id);
    if (from < 0 || to < 0 || to >= ids.length || from === to) return;
    const next = ids.filter((x) => x !== id);
    next.splice(to, 0, id);
    itemTypes.reorder(next);
    plan.announce(`${types[from]!.label} moved to position ${to + 1} of ${ids.length}`);
  };

  return (
    <MovablePanel
      title="Card Types"
      helpArticle="planCardTypes"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-72"
      onMoveTo={() => {}}
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        <ul aria-label="Card types" className="flex flex-col">
          {types.map((t, i) => (
            <li
              key={t.id}
              draggable={canEdit}
              tabIndex={canEdit ? 0 : undefined}
              aria-label={`${t.label}, ${counts.get(t.id) ?? 0} items`}
              onDragStart={(e) => {
                setDragging(t.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragging && dragging !== t.id) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) moveTo(dragging, i);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              onKeyDown={(e) => {
                if (!canEdit || !e.altKey) return;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  moveTo(t.id, i + (e.key === 'ArrowUp' ? -1 : 1));
                }
              }}
              className={`group flex items-center gap-2 rounded-md px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                dragging === t.id ? 'opacity-40' : ''
              } ${canEdit ? 'cursor-grab' : ''}`}
            >
              <span
                className="h-6 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
                aria-hidden
              />
              <PlanTypeGlyph glyph={t.glyph} color={t.color} size={15} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                {t.label}
              </span>
              <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {counts.get(t.id) ?? 0}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  aria-label={`Edit ${t.label}`}
                  onClick={() => plan.editType(t.id)}
                >
                  Edit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <div className="flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              onClick={() => plan.editType('new')}
            >
              + Add Type
            </button>
            {itemTypes.catalogue ? (
              <button
                type="button"
                className="ml-auto rounded-md px-2 py-1 text-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Restore Built-In Types?',
                    message:
                      'The card types go back to the built-in eight. Items of a type they lack keep their fields and show as a plain Item card.',
                    confirmLabel: 'Restore',
                  });
                  if (ok) itemTypes.restoreBuiltIns();
                }}
              >
                Restore Built-In Types
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </MovablePanel>
  );
}
