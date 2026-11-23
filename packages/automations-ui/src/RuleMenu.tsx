'use client';

// A rule's ⋯ menu in the Rules list (liveplanner/docs/specs/026-plan/automations.md "The Automations screen"): Edit, Duplicate,
// Audit Trail, then Delete after a separator, which asks first. Icon-left rows, as every ⋯ menu in the editor. A rule
// the app runs from the list (kit.runRule) opens with Run Rule.

import { useState } from 'react';
import { ConfirmPopover, DuplicateIcon, Tooltip, TrashIcon, lucideGlyph } from '@liveworkspace/ui';
import { lucideHistory, lucidePencil, lucidePlay } from '@liveworkspace/icons/lucide';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';

const EditIcon = lucideGlyph(lucidePencil, 16);
const LogIcon = lucideGlyph(lucideHistory, 16);
export const RunIcon = lucideGlyph(lucidePlay, 16);
const noop = () => {};

export function RuleMenu({
  name,
  onRun,
  onEdit,
  onDuplicate,
  duplicateOff,
  onRunLog,
  onDelete,
}: {
  name: string;
  // Run Rule, for a rule the app runs from the list; absent otherwise.
  onRun?: (() => void) | undefined;
  // With Pro on, why Duplicate is off (the item holds every rule its tier allows), said as its tooltip.
  duplicateOff?: string | undefined;
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
          {onRun ? (
            <MenuActionRow plain label="Run Rule" icon={<RunIcon />} onClick={run(onRun)} />
          ) : null}
          <MenuActionRow plain label="Edit" icon={<EditIcon />} onClick={run(onEdit)} />
          {duplicateOff ? (
            <Tooltip label={duplicateOff}>
              <MenuActionRow
                plain
                disabled
                label="Duplicate"
                icon={<DuplicateIcon />}
                onClick={noop}
              />
            </Tooltip>
          ) : (
            <MenuActionRow
              plain
              label="Duplicate"
              icon={<DuplicateIcon />}
              onClick={run(onDuplicate)}
            />
          )}
          <MenuActionRow plain label="Audit Trail" icon={<LogIcon />} onClick={run(onRunLog)} />
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
          message={`Delete “${name}”? Its runs stay in the Audit Trail until they age out.`}
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
