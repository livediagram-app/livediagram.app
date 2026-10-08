'use client';

// A field's row in the type editor's layout (docs/specs/026-plan/item-types.md "Editing a type").
import type React from 'react';
import { HANDLE_TOUCH, type useHandleReorder } from '@/components/primitives/useHandleReorder';
import { LockIcon, PencilIcon, Tooltip } from '@livediagram/ui';
import { FieldMenu, GripIcon } from './ItemTypeFieldMenu';
import { ICON_BUTTON } from './ItemTypeFieldForms';
import type { GroupId } from './item-type-layout';

// One field: a drag handle (a field that moves), its kind's icon (the Add Field popover's, CustomFieldKindParts),
// its name with a lock when the type always keeps it,
// Edit (a custom field) and a ⋯ menu: Move Up, Move Down, Move to each other group and Remove. Title and Status
// stay put and never come off; a field the type always keeps (a Project's Start and Due) moves but never comes
// off. The handle is for a pointer or a finger; the menu's Move Up and Move Down are the keyboard's way.
// Rows alternate white and a light grey (odd and even in their group), so a long list reads row by row.
export function FieldRow({
  id,
  label,
  icon,
  removable,
  editing,
  onEdit,
  moveTargets,
  onMoveTo,
  handle,
  dragging,
  style,
  canUp,
  canDown,
  onMove,
  onRemove,
  children,
}: {
  id: string;
  label: string;
  // What the field holds, as an icon and its name (the icon's tooltip and accessible name).
  icon: { node: React.ReactNode; name: string };
  // False for a field that never comes off (Title, Status, a type's kept fields): no Remove, and a lock.
  removable: boolean;
  editing: boolean;
  onEdit?: () => void;
  moveTargets: readonly { id: GroupId; label: string }[];
  onMoveTo: (to: GroupId) => void;
  // The handle's pointer handlers, for a field that can be dragged within its group.
  handle?: ReturnType<ReturnType<typeof useHandleReorder>['handleProps']> | undefined;
  dragging: boolean;
  style?: React.CSSProperties | undefined;
  canUp: boolean;
  canDown: boolean;
  onMove?: ((by: -1 | 1) => void) | undefined;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  const hasMenu = removable || moveTargets.length > 0 || (onMove && (canUp || canDown));
  return (
    <li
      data-reorder-id={id}
      style={style}
      className={`rounded-lg border px-1.5 py-1 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 ${
        dragging
          ? 'border-brand-400 shadow-md dark:border-brand-500'
          : 'border-slate-200 shadow-sm dark:border-slate-700'
      }`}
    >
      <div className="flex min-h-8 items-center gap-1">
        {handle ? (
          <span
            aria-hidden
            {...handle}
            className={`flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${HANDLE_TOUCH}`}
          >
            <GripIcon />
          </span>
        ) : (
          <span aria-hidden className="h-7 w-5 shrink-0" />
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          <Tooltip label={icon.name}>
            <span
              role="img"
              aria-label={icon.name}
              className="flex h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 [&_svg]:h-full [&_svg]:w-full"
            >
              {icon.node}
            </span>
          </Tooltip>
          <span className="truncate">{label}</span>
          {!removable ? (
            <Tooltip label={`${label} is always on this type`}>
              <span
                tabIndex={0}
                aria-label={`${label} is always on this type`}
                className="flex shrink-0 text-slate-400 dark:text-slate-400"
              >
                <LockIcon size={11} />
              </span>
            </Tooltip>
          ) : null}
        </span>
        {onEdit ? (
          <button
            type="button"
            className={`${ICON_BUTTON} ${editing ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : ''}`}
            aria-label={editing ? `Done editing ${label}` : `Edit ${label}`}
            aria-expanded={editing}
            onClick={onEdit}
          >
            <PencilIcon size={13} />
          </button>
        ) : null}
        {hasMenu ? (
          <FieldMenu
            label={label}
            moveTargets={moveTargets}
            onMoveTo={onMoveTo}
            canUp={canUp}
            canDown={canDown}
            onMove={onMove}
            onRemove={removable ? onRemove : undefined}
          />
        ) : (
          <span aria-hidden className="h-7 w-7 shrink-0" />
        )}
      </div>
      {children}
    </li>
  );
}
