'use client';

// The Card Types panel (docs/specs/025-plan/item-types.md "The Card Types panel"): the document's item
// types, each with its glyph and colour, its name and how many items have it. A popover hanging above
// its button in Plan mode's bottom-right cluster. Edit and Add Type open the type editor; rows reorder
// by drag, or Alt with the arrow keys; Restore built-in types puts the built-ins back. Someone who
// may only view sees the list.
import { useMemo, useState } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { usePlan } from './PlanContext';
import { PencilIcon, PlusIcon } from '@livediagram/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_BG, ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

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
        <ul aria-label="Card types" className="flex flex-col gap-1.5">
          {types.map((t, i) => {
            const count = counts.get(t.id) ?? 0;
            const fields = t.fields.length;
            return (
              <li
                key={t.id}
                draggable={canEdit}
                tabIndex={0}
                role={canEdit ? 'button' : undefined}
                aria-label={`${t.label}, ${count} ${count === 1 ? 'item' : 'items'}${canEdit ? '. Edit' : ''}`}
                onClick={canEdit ? () => plan.editType(t.id) : undefined}
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
                  if (!canEdit) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    plan.editType(t.id);
                  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    moveTo(t.id, i + (e.key === 'ArrowUp' ? -1 : 1));
                  }
                }}
                className={`group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-2 outline-none transition dark:border-slate-700 dark:bg-slate-900 ${
                  canEdit
                    ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:border-slate-600'
                    : ''
                } ${dragging === t.id ? 'opacity-40' : ''}`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${ACCENT_BG}`}
                  style={accentVars(t.color)}
                  aria-hidden
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
                  style={accentVars(t.color)}
                  aria-hidden
                >
                  <PlanTypeGlyph glyph={t.glyph} size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {t.label}
                  </span>
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {fields} {fields === 1 ? 'field' : 'fields'}
                    {t.custom?.length ? `, ${t.custom.length} custom` : ''}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  aria-hidden
                >
                  {count}
                </span>
                {canEdit ? (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200"
                    aria-hidden
                  >
                    <PencilIcon />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {canEdit ? (
          <>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
              onClick={() => plan.editType('new')}
            >
              <PlusIcon />
              Add Type
            </button>
            {itemTypes.catalogue ? (
              <button
                type="button"
                className="self-center rounded-md px-2 py-0.5 text-[11px] text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Restore Built-In Types?',
                    message:
                      'The card types go back to the built-in five. Items of a type they lack keep their fields and show as a plain Item card.',
                    confirmLabel: 'Restore',
                  });
                  if (ok) itemTypes.restoreBuiltIns();
                }}
              >
                Restore built-in types
              </button>
            ) : null}
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
              Drag to reorder. The palette's Cards follow this order.
            </p>
          </>
        ) : null}
      </div>
    </MovablePanel>
  );
}
