'use client';

// The dashed add buttons under the steps (docs/specs/026-plan/automations.md "The rule builder"): + Add Action (the
// Add an Action picker, AddActionDialog), + Add Condition (a menu of kinds), + If / Else and + For Related Cards at the rule's top level. The
// outgoing actions are offered at the top level only, while the rule holds fewer than 5; an If / Else's lists add
// actions alone; a branch adds its own conditions and actions, Create Card left out. Each menu row wears the step's
// own icon.

import { useState } from 'react';
import {
  AUTOMATION_CONDITION_NAMES,
  type AutomationCondition,
  type AutomationRuleBody,
} from '@liveplanner/items';
import { Button, PlusIcon } from '@liveplanner/ui';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AddActionButton } from './AddActionDialog';
import { ConditionIcon } from './automation-glyphs';
import { canAddAction, canAddCondition, type Side } from './rule-draft';
import { CONDITION_KINDS, type AddKind } from './step-defaults';

export type AddActions = {
  addCondition: (kind: AutomationCondition['kind'], holder?: number) => void;
  addAction: (kind: AddKind, branch?: { step: number; side: Side }) => void;
  addIfElse: () => void;
  addBranch: () => void;
};

const DASHED = 'border-dashed';

/** A dashed add button that opens a menu of kinds; `group`, a second set under a rule and a heading. */
export function AddMenu<K extends string>({
  label,
  kinds,
  group,
  names,
  icon,
  disabled,
  onPick,
}: {
  label: string;
  kinds: readonly K[];
  group?: { title: string; note: string; kinds: readonly K[] } | undefined;
  names: Readonly<Record<K, string>>;
  icon: (kind: K) => React.ReactNode;
  disabled: boolean;
  onPick: (kind: K) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const row = (k: K) => (
    <MenuActionRow
      key={k}
      plain
      label={names[k]}
      icon={icon(k)}
      onClick={() => {
        setAnchor(null);
        onPick(k);
      }}
    />
  );
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        className={DASHED}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        disabled={disabled}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <PlusIcon size={12} />
        {label}
      </Button>
      {anchor ? (
        <PortalMenu anchor={anchor} placement="below" onClose={() => setAnchor(null)}>
          {kinds.map(row)}
          {group ? (
            <>
              <MenuGroupSeparator />
              <div className="flex items-baseline justify-between gap-3 px-3 pb-1 pt-0.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {group.title}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{group.note}</span>
              </div>
              {group.kinds.map(row)}
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </>
  );
}

const conditionIcon = () => <ConditionIcon />;

/** The rule's own add buttons: actions (outgoing ones too), conditions, If / Else and For Related Cards. */
export function TopAddButtons({
  body,
  actions,
}: {
  body: AutomationRuleBody;
  actions: AddActions;
}) {
  const full = !canAddAction(body);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddActionButton
        body={body}
        where="top"
        disabled={full}
        onPick={(k) => actions.addAction(k)}
      />
      <AddMenu
        label="Add Condition"
        kinds={CONDITION_KINDS}
        names={AUTOMATION_CONDITION_NAMES}
        icon={conditionIcon}
        disabled={!canAddCondition(body.conditions)}
        onPick={(k) => actions.addCondition(k)}
      />
      <Button
        variant="secondary"
        size="xs"
        className={DASHED}
        disabled={full}
        onClick={actions.addIfElse}
      >
        <PlusIcon size={12} />
        If / Else
      </Button>
      <Button
        variant="secondary"
        size="xs"
        className={DASHED}
        disabled={full}
        onClick={actions.addBranch}
      >
        <PlusIcon size={12} />
        For Related Cards
      </Button>
    </div>
  );
}

/** An If / Else list's or a branch's add buttons: its actions, and a branch's own conditions. `conditionsOnly`: an
 *  If / Else's Add Condition to If, under its lists. */
export function HolderAddButtons({
  body,
  step,
  side,
  actions,
  conditionsOnly = false,
}: {
  body: AutomationRuleBody;
  step: number;
  side: Side;
  actions: AddActions;
  conditionsOnly?: boolean;
}) {
  const holder = body.steps[step];
  const branch = holder?.kind === 'for';
  const conditions = holder?.kind === 'for' || holder?.kind === 'if' ? holder.conditions : [];
  const addCondition = (
    <AddMenu
      label={conditionsOnly ? 'Add Condition to If' : 'Add Condition'}
      kinds={CONDITION_KINDS}
      names={AUTOMATION_CONDITION_NAMES}
      icon={conditionIcon}
      disabled={!canAddCondition(conditions)}
      onPick={(k) => actions.addCondition(k, step)}
    />
  );
  if (conditionsOnly) return <div>{addCondition}</div>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddActionButton
        body={body}
        where={branch ? 'branch' : 'list'}
        disabled={!canAddAction(body, step)}
        onPick={(k) => actions.addAction(k, { step, side })}
      />
      {branch ? addCondition : null}
    </div>
  );
}
