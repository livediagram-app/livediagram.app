'use client';

// The Add an Action picker (docs/specs/026-plan/automations.md "The rule builder"): + Add Action opens a dialog of
// every action it may add, in groups (action-groups.ts), each tile with its picture (ActionScene), its icon, its name
// and a line on what it does, in the pickers' shared dialog (StepPicker).

import { useMemo, useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { Button, PlusIcon } from '@liveplanner/ui';
import { ActionScene } from './ActionScene';
import { addActionHeroArt } from './AddActionHeroArt';
import { StepTile } from './automation-glyphs';
import { ACTION_LINES, pickerGroups, type ActionGroupId } from './action-groups';
import { StepPicker } from './StepPicker';
import { ADD_NAMES, isAiKind, isOutgoingKind, viaOf, type AddKind } from './step-defaults';

export const tileIcon = (k: AddKind) =>
  isAiKind(k) ? (
    <StepTile tone="action" kind="ai" size={24} />
  ) : isOutgoingKind(k) ? (
    <StepTile tone="action" kind="notify" via={viaOf(k)} size={24} />
  ) : (
    <StepTile tone="action" kind={k} size={24} />
  );

/** The dashed + Add Action button and the picker it opens. `where`: the rule's top level, an If / Else list, or a
 *  branch. */
export function AddActionButton({
  body,
  where,
  disabled,
  onPick,
}: {
  body: AutomationRuleBody;
  where: 'top' | 'list' | 'branch';
  disabled: boolean;
  onPick: (kind: AddKind) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        className="border-dashed"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={12} />
        Add Action
      </Button>
      {open ? (
        <AddActionDialog
          body={body}
          where={where}
          onClose={() => setOpen(false)}
          onPick={(k) => {
            setOpen(false);
            onPick(k);
          }}
        />
      ) : null}
    </>
  );
}

export function AddActionDialog({
  body,
  where,
  onClose,
  onPick,
  current,
  only,
}: {
  // Null when changing a step's kind: nothing reads as full.
  body: AutomationRuleBody | null;
  where: 'top' | 'list' | 'branch';
  onClose: () => void;
  onPick: (kind: AddKind) => void;
  // Changing a step: its kind now, badged Current (the picker is titled Change the Action).
  current?: AddKind;
  // Changing an outgoing step: its group alone (Webhook, Slack, Teams).
  only?: ActionGroupId;
}) {
  const sections = useMemo(
    () =>
      pickerGroups(body, where)
        .filter((g) => !only || g.id === only)
        .map((g) => ({
          id: g.id,
          name: g.name,
          ...(g.note ? { note: g.note } : {}),
          ...(g.full ? { full: g.full } : {}),
          tiles: g.kinds.map((k) => ({
            key: k,
            name: ADD_NAMES[k],
            line: ACTION_LINES[k],
            icon: tileIcon(k),
            scene: <ActionScene kind={k} group={g.id} />,
          })),
        })),
    [body, where, only],
  );
  return (
    <StepPicker
      title={current ? 'Change the Action' : 'Add an Action'}
      line={current ? 'What should this step do instead?' : 'What should this rule do to the card?'}
      art={addActionHeroArt}
      noun="action"
      emptyHint="Try another word, such as “label”, “email” or “Slack”."
      sections={sections}
      current={current}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
