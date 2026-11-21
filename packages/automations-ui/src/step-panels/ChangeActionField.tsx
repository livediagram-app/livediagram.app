'use client';

// An action panel's Action field (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): the action's
// tile and name, and Change, which opens the Add an Action picker as Change the Action, offering what the step can
// become (the actions an If / Else list or a branch takes), the current one badged. A message step's offers the
// other tools alone.

import { useState } from 'react';
import { ActionTile, AddActionDialog } from '../AddActionDialog';
import { useAutomationsKit } from '../kit-context';
import { ChangeRow, PanelField } from './panel-parts';

const isMessage = (key: string) => key.startsWith('notify_');

export function ChangeActionField({
  actionKey,
  branch,
  onChange,
}: {
  // The step's tile (types.ts stepKey).
  actionKey: string;
  // Inside the app's branch.
  branch: boolean;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const kit = useAutomationsKit();
  const message = isMessage(actionKey);
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
              body={null}
              // A message step sits at the top level, and becomes another tool's; any other becomes what an
              // If / Else list or a branch takes (the plain actions alone).
              where={message ? 'top' : branch ? 'branch' : 'list'}
              {...(message ? { only: isMessage } : {})}
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
