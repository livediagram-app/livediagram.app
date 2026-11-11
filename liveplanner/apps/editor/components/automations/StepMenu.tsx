'use client';

// A step's ⋯ menu in the builder (docs/specs/026-plan/automations.md "The rule builder"): Move Up, Move Down,
// Duplicate, then Delete after a separator. A move that cannot happen is greyed. Delete needs no confirm: Discard
// Changes? stands behind every unsaved edit.

import { useState } from 'react';
import { DuplicateIcon, TrashIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideArrowDown, lucideArrowUp } from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { StepEdit } from './rule-draft';

const UpIcon = lucideGlyph(lucideArrowUp, 16);
const DownIcon = lucideGlyph(lucideArrowDown, 16);

export function StepMenu({
  name,
  canUp,
  canDown,
  canDuplicate,
  onEdit,
}: {
  name: string;
  canUp: boolean;
  canDown: boolean;
  canDuplicate: boolean;
  onEdit: (edit: StepEdit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const run = (edit: StepEdit) => () => {
    setOpen(false);
    onEdit(edit);
  };
  return (
    <>
      <EllipsisTriggerButton
        ref={setButton}
        label={`More for ${name}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuActionRow
            plain
            label="Move Up"
            icon={<UpIcon />}
            disabled={!canUp}
            onClick={run('up')}
          />
          <MenuActionRow
            plain
            label="Move Down"
            icon={<DownIcon />}
            disabled={!canDown}
            onClick={run('down')}
          />
          <MenuActionRow
            plain
            label="Duplicate"
            icon={<DuplicateIcon />}
            disabled={!canDuplicate}
            onClick={run('duplicate')}
          />
          <MenuGroupSeparator />
          <MenuActionRow plain label="Delete" icon={<TrashIcon />} onClick={run('delete')} />
        </PortalMenu>
      ) : null}
    </>
  );
}
