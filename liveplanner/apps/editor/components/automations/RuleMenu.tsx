'use client';

// A rule's ⋯ menu in the Rules list (docs/specs/026-plan/automations.md "The Automations screen"): Edit, Duplicate,
// Run Log, then Delete after a separator, which asks first. Icon-left rows, as every ⋯ menu in the editor.

import { useState } from 'react';
import { ConfirmPopover, DuplicateIcon, TrashIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideHistory, lucidePencil } from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';

const EditIcon = lucideGlyph(lucidePencil, 16);
const LogIcon = lucideGlyph(lucideHistory, 16);

export function RuleMenu({
  name,
  onEdit,
  onDuplicate,
  onRunLog,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onRunLog: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <>
      <EllipsisTriggerButton
        ref={setButton}
        size="lg"
        label={`More for ${name}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuActionRow plain label="Edit" icon={<EditIcon />} onClick={run(onEdit)} />
          <MenuActionRow
            plain
            label="Duplicate"
            icon={<DuplicateIcon />}
            onClick={run(onDuplicate)}
          />
          <MenuActionRow plain label="Run Log" icon={<LogIcon />} onClick={run(onRunLog)} />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            label="Delete"
            icon={<TrashIcon />}
            onClick={run(() => setConfirming(true))}
          />
        </PortalMenu>
      ) : null}
      {confirming && button ? (
        <ConfirmPopover
          anchor={button}
          message={`Delete “${name}”? Its runs stay in the Run Log until they age out.`}
          confirmLabel="Delete Rule"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
        />
      ) : null}
    </>
  );
}
