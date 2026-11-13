'use client';

// An action's panel (docs/specs/026-plan/automations.md "Actions"): its kind, changed in the Add an Action picker
// (ChangeActionField; changing it starts that kind afresh),
// then the kind's own fields. Flag, Unflag, Archive, Restore From Archive and Resolve Threads have nothing to set. Inside a branch the kinds leave out
// Create Card and the text offers the triggering card's values; on a time rule nothing names whoever triggered it.

import type { AutomationAction, AutomationActionKind } from '@liveplanner/items';
import type { AutomationOutline } from '../automation-outline';
import { startAction } from '../step-defaults';
import { ChangeActionField } from './ChangeActionField';
import { AssignPanel } from './AssignPanel';
import { CopyCardPanel, SetColourPanel, SetTypePanel } from './CardActionPanels';
import { ChecklistActionPanel } from './ChecklistActionPanel';
import { LinkCardPanel } from './LinkCardPanel';
import { CreateCardPanel } from './CreateCardPanel';
import { FieldActionPanel } from './FieldActionPanel';
import { LabelActionPanel } from './LabelActionPanel';
import { MoveActionPanel } from './MoveActionPanel';
import { PanelNote } from './panel-parts';
import { TextActionPanel } from './TextActionPanel';

const NOTHING_TO_SET: Partial<Record<AutomationActionKind, string>> = {
  flag: 'Flags the card. Nothing else to set.',
  unflag: 'Takes the card’s flag off. Nothing else to set.',
  archive:
    'Archives the card. It stays in the Archive, where anyone who can edit can bring it back.',
  restore: 'Brings an archived card back to its board. A card that isn’t archived stays as it is.',
  resolve_threads:
    'Resolves every open comment thread on the card, by Automation. Anyone can reopen one.',
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
      case 'mention':
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
      case 'set_type':
        return <SetTypePanel action={action} onChange={onChange} outline={outline} />;
      case 'set_colour':
        return <SetColourPanel action={action} onChange={onChange} />;
      case 'copy_card':
        return <CopyCardPanel action={action} onChange={onChange} outline={outline} />;
      case 'add_checklist':
        return <ChecklistActionPanel action={action} onChange={onChange} invalid={invalid} />;
      case 'link_card':
        return (
          <LinkCardPanel
            action={action}
            onChange={onChange}
            outline={outline}
            branch={branch}
            invalid={invalid}
          />
        );
      case 'flag':
      case 'unflag':
      case 'archive':
      case 'restore':
      case 'resolve_threads':
        return <PanelNote>{NOTHING_TO_SET[action.kind]}</PanelNote>;
    }
  })();
  return (
    <div className="flex flex-col gap-4">
      <ChangeActionField
        kind={action.kind}
        branch={branch}
        onChange={(kind) => {
          if (kind !== action.kind) onChange(startAction(kind, outline, timeRule));
        }}
      />
      {body}
    </div>
  );
}
