'use client';

// An action panel's Action field (docs/specs/026-plan/automations.md "The rule builder"): the action's tile and name,
// and Change, which opens the Add an Action picker as Change the Action, offering what the step can become (the
// actions an If / Else list or a branch takes), the current one badged. An outgoing step's (ChangeOutgoingField)
// offers the other tools alone.

import { useState } from 'react';
import { AUTOMATION_STEP_NAMES, type AutomationActionKind } from '@liveplanner/items';
import { Button } from '@liveplanner/ui';
import { AddActionDialog, tileIcon } from '../AddActionDialog';
import { StepTile } from '../automation-glyphs';
import {
  ADD_NAMES,
  OUTGOING_KINDS,
  isAiKind,
  isOutgoingKind,
  type OutgoingKind,
} from '../step-defaults';
import { PanelField } from './panel-parts';

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
          <div className="flex h-11 items-center gap-2.5 rounded-lg border border-slate-200 bg-white pl-2 pr-1.5 dark:border-slate-700 dark:bg-slate-900">
            <StepTile tone="action" kind={kind} size={24} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {AUTOMATION_STEP_NAMES[kind]}
            </span>
            <Button
              id={id}
              variant="secondary"
              size="xs"
              data-change-step=""
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              Change
            </Button>
          </div>
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
          <div className="flex h-11 items-center gap-2.5 rounded-lg border border-slate-200 bg-white pl-2 pr-1.5 dark:border-slate-700 dark:bg-slate-900">
            {tileIcon(kind)}
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {ADD_NAMES[kind]}
            </span>
            <Button
              id={id}
              variant="secondary"
              size="xs"
              data-change-step=""
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              Change
            </Button>
          </div>
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
