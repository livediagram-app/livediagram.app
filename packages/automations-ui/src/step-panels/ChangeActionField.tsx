'use client';

// An action panel's Action field (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): the action's
// tile and name, and Change, which opens the Add an Action picker as Change the Action, the current one badged. It
// offers exactly what Add Action offers where the step stands: at the rule's top level every action (one nothing may
// follow only for the last step), in an If / Else list or a branch what those take. A family the rest of the rule
// holds all it may of is dimmed and says so, as Add Action's.

import { useMemo, useState } from 'react';
import { ActionTile, AddActionDialog, type PickerWhere } from '../AddActionDialog';
import { useAutomationsKit } from '../kit-context';
import type { RuleBody } from '../types';
import { ChangeRow, PanelField } from './panel-parts';

export function ChangeActionField({
  actionKey,
  where,
  rest = null,
  last = true,
  onChange,
}: {
  // The step's tile (types.ts stepKey).
  actionKey: string;
  // Where the step stands: the rule's top level, an If / Else list, or the app's branch.
  where: PickerWhere;
  // The rule without this step, for what is full (null: nothing reads as full).
  rest?: RuleBody | null;
  // At the top level: whether it is the rule's last step, where one nothing may follow can stand.
  last?: boolean;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const kit = useAutomationsKit();
  const only = useMemo(
    () => (last ? undefined : (k: string) => !kit.kinds.actions[k]?.last),
    [kit, last],
  );
  return (
    <PanelField label="Action">
      {(id) => (
        <>
          <ChangeRow
            id={id}
            noun="Action"
            icon={<ActionTile actionKey={actionKey} />}
            name={kit.kinds.actions[actionKey]?.name ?? ''}
            open={open}
            onOpen={() => setOpen(true)}
          />
          {open ? (
            <AddActionDialog
              body={rest}
              where={where}
              {...(only ? { only } : {})}
              current={actionKey}
              onClose={() => setOpen(false)}
              onPick={(k) => {
                setOpen(false);
                if (k !== actionKey) onChange(k);
              }}
            />
          ) : null}
        </>
      )}
    </PanelField>
  );
}
