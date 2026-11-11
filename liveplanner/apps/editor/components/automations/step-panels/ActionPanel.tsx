'use client';

// An action's panel (docs/specs/026-plan/automations.md "Actions"): its kind (changing it starts that kind afresh),
// then the kind's own fields. Flag, Unflag and Archive have nothing to set. Inside a branch the kinds leave out
// Create Card and the text offers the triggering card's values; on a time rule nothing names whoever triggered it.

import {
  AUTOMATION_STEP_NAMES,
  type AutomationAction,
  type AutomationActionKind,
} from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { ACTION_KINDS, BRANCH_ACTION_KINDS, defaultAction } from '../step-defaults';
import { AssignPanel } from './AssignPanel';
import { CreateCardPanel } from './CreateCardPanel';
import { FieldActionPanel } from './FieldActionPanel';
import { LabelActionPanel } from './LabelActionPanel';
import { MoveActionPanel } from './MoveActionPanel';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';
import { TextActionPanel } from './TextActionPanel';

const NOTHING_TO_SET: Partial<Record<AutomationActionKind, string>> = {
  flag: 'Flags the card. Nothing else to set.',
  unflag: 'Takes the card’s flag off. Nothing else to set.',
  archive:
    'Archives the card. It stays in the Archive, where anyone who can edit can bring it back.',
};

export function ActionPanel({
  action,
  onChange,
  outline,
  invalidPath,
  branch = false,
  timeRule = false,
}: {
  action: AutomationAction;
  onChange: (next: AutomationAction) => void;
  outline: AutomationOutline;
  // The refusal's path within this action ('' for the action itself, 'text' for its text), or null.
  invalidPath: string | null;
  // An action inside a For Related Cards branch.
  branch?: boolean;
  // The rule's trigger is a time.
  timeRule?: boolean;
}) {
  const invalid = invalidPath !== null;
  const body = (() => {
    switch (action.kind) {
      case 'move':
        return <MoveActionPanel action={action} onChange={onChange} outline={outline} />;
      case 'set_field':
      case 'clear_field':
        return (
          <FieldActionPanel
            action={action}
            onChange={onChange}
            outline={outline}
            invalid={invalid}
            branch={branch}
          />
        );
      case 'assign':
        return (
          <AssignPanel action={action} onChange={onChange} outline={outline} timeRule={timeRule} />
        );
      case 'add_label':
      case 'remove_label':
        return (
          <LabelActionPanel
            action={action}
            onChange={onChange}
            outline={outline}
            invalid={invalid}
          />
        );
      case 'comment':
      case 'email':
        return (
          <TextActionPanel
            action={action}
            onChange={onChange}
            outline={outline}
            invalidPath={invalidPath}
            branch={branch}
            timeRule={timeRule}
          />
        );
      case 'create_card':
        return (
          <CreateCardPanel
            action={action}
            onChange={onChange}
            outline={outline}
            invalid={invalid}
          />
        );
      case 'flag':
      case 'unflag':
      case 'archive':
        return <PanelNote>{NOTHING_TO_SET[action.kind]}</PanelNote>;
    }
  })();
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Action">
        {(id) => (
          <PanelSelect
            id={id}
            value={action.kind}
            onChange={(e) =>
              onChange(defaultAction(e.target.value as AutomationActionKind, outline))
            }
          >
            {(branch ? BRANCH_ACTION_KINDS : ACTION_KINDS).map((k) => (
              <option key={k} value={k}>
                {AUTOMATION_STEP_NAMES[k]}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {body}
    </div>
  );
}
