'use client';

// A step's ⋯ menu in the builder (docs/specs/026-plan/automations.md "The rule builder"): Move Up, Move Down,
// Duplicate, then Delete after a separator. A move that cannot happen is greyed, and after one focus stays on the
// moved step's ⋯ in its new place. Delete needs no confirm: Discard Changes? stands behind every unsaved edit.

import { useEffect, useState } from 'react';
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
  takeFocus = false,
  onFocused,
}: {
  name: string;
  canUp: boolean;
  canDown: boolean;
  canDuplicate: boolean;
  onEdit: (edit: StepEdit) => void;
  // Its step was just moved here: the ⋯ takes focus (after the closing menu's own focus return), once.
  takeFocus?: boolean;
  onFocused?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!takeFocus || !button) return;
    button.focus({ preventScroll: true });
    onFocused?.();
  }, [takeFocus, button, onFocused]);
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
