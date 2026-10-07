'use client';

// A field's ⋯ menu in the type editor (docs/specs/026-plan/item-types.md "Editing a type"): Move Up and Move Down
// (the keyboard's way to reorder; a pointer or a finger drags the handle), Move to each other group, and Remove,
// as icon-left rows, so a field's row keeps only its handle, name and the menu.
import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, TabsLabelIcon, TrashIcon, lucideGlyph } from '@livediagram/ui';
import { lucideGripVertical } from '@livediagram/icons/lucide';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import type { GroupId } from './item-type-layout';

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
              <MenuActionRow
                plain
                danger
                label="Remove"
                icon={<TrashIcon />}
                onClick={run(onRemove)}
              />
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </>
  );
}
