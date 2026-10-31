'use client';

// A field's ⋯ menu in the type editor (docs/specs/026-plan/item-types.md "Editing a type"): Move Up and Move Down
// (the keyboard's way to reorder; a pointer or a finger drags the handle), Move to each other group, and Remove,
// as icon-left rows, so a field's row keeps only its handle, name and the menu. The Assignee's adds its Notifies
// switch first (item-types.md "Notifies").
import { useId, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Switch,
  TabsLabelIcon,
  TrashIcon,
  lucideGlyph,
} from '@liveplanner/ui';
import { useMenuItemProps } from '@liveworkspace/workbench/components/primitives/menu-item-props';
import { lucideGripVertical } from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { GroupId } from './item-type-layout';
import { NOTIFIES_LINE } from './ItemTypeFieldForms';

// A field's drag handle.
export const GripIcon = lucideGlyph(lucideGripVertical, 14);

export function FieldMenu({
  label,
  moveTargets,
  onMoveTo,
  canUp,
  canDown,
  onMove,
  onRemove,
  notifies,
}: {
  label: string;
  moveTargets: readonly { id: GroupId; label: string }[];
  onMoveTo: (to: GroupId) => void;
  canUp: boolean;
  canDown: boolean;
  // Absent for a field that stays put in its group.
  onMove?: ((by: -1 | 1) => void) | undefined;
  // Absent for a field the type always keeps.
  onRemove?: (() => void) | undefined;
  // The Assignee's Notifies switch: on, and what flips it. Absent for any other field.
  notifies?: NotifiesToggle | undefined;
}) {
  const [open, setOpen] = useState(false);
  // Held in state so the menu anchors on its first render.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const reorder = onMove && (canUp || canDown);
  return (
    <>
      <EllipsisTriggerButton
        ref={setButton}
        size="md"
        label={`More for ${label}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuHeader title={label} />
          {notifies ? (
            <>
              <MenuNotifiesRow {...notifies} />
              {reorder || moveTargets.length > 0 || onRemove ? <MenuGroupSeparator /> : null}
            </>
          ) : null}
          {reorder ? (
            <>
              <MenuActionRow
                plain
                label="Move Up"
                icon={<ArrowUpIcon size={14} />}
                disabled={!canUp}
                onClick={run(() => onMove(-1))}
              />
              <MenuActionRow
                plain
                label="Move Down"
                icon={<ArrowDownIcon size={14} />}
                disabled={!canDown}
                onClick={run(() => onMove(1))}
              />
            </>
          ) : null}
          {reorder && moveTargets.length > 0 ? <MenuGroupSeparator /> : null}
          {moveTargets.map((g) => (
            <MenuActionRow
              key={g.id ?? 'details'}
              plain
              label={`Move to ${g.label}`}
              icon={<TabsLabelIcon />}
              onClick={run(() => onMoveTo(g.id))}
            />
          ))}
          {onRemove ? (
            <>
              {reorder || moveTargets.length > 0 ? <MenuGroupSeparator /> : null}
              <MenuActionRow plain label="Remove" icon={<TrashIcon />} onClick={run(onRemove)} />
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </>
  );
}

export type NotifiesToggle = { on: boolean; onChange: (on: boolean) => void };

// Notifies as a menu row that flips in place (a checkable menu item, the menu stays open): its name and line, and the
// house switch drawn at the end. Named by its name alone; the line describes it.
function MenuNotifiesRow({ on, onChange }: NotifiesToggle) {
  const ids = useId();
  const { itemProps } = useMenuItemProps({ checked: on });
  return (
    <button
      type="button"
      {...itemProps}
      aria-labelledby={`${ids}-name`}
      aria-describedby={`${ids}-line`}
      onClick={() => onChange(!on)}
      className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${ids}-name`} className="font-medium">
          Notifies
        </span>
        <span
          id={`${ids}-line`}
          className="text-[11px] leading-snug text-slate-500 dark:text-slate-400"
        >
          {NOTIFIES_LINE}
        </span>
      </span>
      <Switch presentational size="sm" checked={on} className="mt-0.5" />
    </button>
  );
}
