'use client';

// An action panel's Action field (docs/specs/026-plan/automations.md "The rule builder"): the action's tile and name,
// and Change, which opens the Add an Action picker as Change the Action, offering what the step can become (the
// actions an If / Else list or a branch takes), the current one badged. An outgoing step's (ChangeOutgoingField)
// offers the other tools alone.

import { useState } from 'react';
import { AUTOMATION_STEP_NAMES, type AutomationActionKind } from '@liveplanner/items';
import { AddActionDialog, tileIcon } from '../AddActionDialog';
import { StepTile } from '../automation-glyphs';
import {
  ADD_NAMES,
  OUTGOING_KINDS,
  isAiKind,
  isOutgoingKind,
  type OutgoingKind,
} from '../step-defaults';
import { ChangeRow, PanelField } from './panel-parts';

export function ChangeActionField({
  kind,
  branch,
  onChange,
}: {
  kind: AutomationActionKind;
  branch: boolean;
  onChange: (kind: AutomationActionKind) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PanelField label="Action">
      {(id) => (
        <>
          <ChangeRow
            id={id}
            noun="Action"
            icon={<StepTile tone="action" kind={kind} size={24} />}
            name={AUTOMATION_STEP_NAMES[kind]}
            open={open}
            onOpen={() => setOpen(true)}
          />
          {open ? (
            <AddActionDialog
              body={null}
              where={branch ? 'branch' : 'list'}
              current={kind}
              onClose={() => setOpen(false)}
              onPick={(k) => {
                setOpen(false);
                // The list and branch groups hold the plain actions alone.
                if (k !== 'wait' && !isAiKind(k) && !isOutgoingKind(k)) onChange(k);
              }}
            />
          ) : null}
        </>
      )}
    </PanelField>
  );
}

export function ChangeOutgoingField({
  kind,
  onChange,
}: {
  kind: OutgoingKind;
  onChange: (kind: OutgoingKind) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PanelField label="Action">
      {(id) => (
        <>
          <ChangeRow
            id={id}
            noun="Action"
            icon={tileIcon(kind)}
            name={ADD_NAMES[kind]}
            open={open}
            onOpen={() => setOpen(true)}
          />
          {open ? (
            <AddActionDialog
              body={null}
              where="top"
              only="tools"
              current={kind}
              onClose={() => setOpen(false)}
              onPick={(k) => {
                setOpen(false);
                const next = OUTGOING_KINDS.find((o) => o === k);
                if (next) onChange(next);
              }}
            />
          ) : null}
        </>
      )}
    </PanelField>
  );
}
