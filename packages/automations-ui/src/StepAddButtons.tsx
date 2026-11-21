'use client';

// The dashed add buttons under the steps (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): + Add
// Action (the Add an Action picker, AddActionDialog), + Add Condition (a menu of kinds), + If / Else and the app's
// branch at the rule's top level. The steps of the top level alone are offered there only, each while the rule holds
// fewer than it may; an If / Else's lists add actions alone; a branch adds its own conditions and actions. Once the
// rule ends on a step nothing may follow, nothing more is added after it.

import { useState } from 'react';
import { Button, PlusIcon } from '@liveworkspace/ui';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AddActionButton } from './AddActionDialog';
import { ConditionIcon } from './glyphs';
import { useAutomationsKit } from './kit-context';
import { canAddAction, canAddCondition, type Side } from './rule-draft';
import { isHolder, stepKey, type RuleBody } from './types';

export type AddActions = {
  addCondition: (kind: string, holder?: number) => void;
  // `key`: the tile picked (types.ts stepKey).
  addAction: (key: string, branch?: { step: number; side: Side }) => void;
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

// Add Condition's kinds and their names, from the kit's record. A kind that reads whoever started the rule
// (`personal`) is left out under a trigger nobody is behind.
function useConditionKinds(body: RuleBody): {
  kinds: readonly string[];
  names: Readonly<Record<string, string>>;
} {
  const { conditions, triggers } = useAutomationsKit().kinds;
  const personless = !!triggers[body.trigger.kind]?.personless;
  const kinds = Object.keys(conditions).filter((k) => !personless || !conditions[k]?.personal);
  return {
    kinds,
    names: Object.fromEntries(
      kinds.map((k) => [k, (conditions as Record<string, { name: string }>)[k]!.name]),
    ),
  };
}

/** The rule's own add buttons: actions (the top level's own too), conditions, If / Else and the app's branch. */
export function TopAddButtons({ body, actions }: { body: RuleBody; actions: AddActions }) {
  const { kinds } = useAutomationsKit();
  const conditions = useConditionKinds(body);
  const last = body.steps[body.steps.length - 1];
  // The rule ends on a step nothing may follow.
  const ended = !!last && !!kinds.actions[stepKey(last)]?.last;
  const full = ended || !canAddAction(body);
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
        kinds={conditions.kinds}
        names={conditions.names}
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
      {kinds.branch ? (
        <Button
          variant="secondary"
          size="xs"
          className={DASHED}
          disabled={full}
          onClick={actions.addBranch}
        >
          <PlusIcon size={12} />
          {kinds.branch.name}
        </Button>
      ) : null}
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
  body: RuleBody;
  step: number;
  side: Side;
  actions: AddActions;
  conditionsOnly?: boolean;
}) {
  const { kinds } = useAutomationsKit();
  const conditions = useConditionKinds(body);
  const holder = body.steps[step];
  const branch = isHolder(holder) && !holder.else;
  const held = isHolder(holder) ? holder.conditions : [];
  const addCondition = (
    <AddMenu
      label={conditionsOnly ? 'Add Condition to If' : 'Add Condition'}
      kinds={conditions.kinds}
      names={conditions.names}
      icon={conditionIcon}
      disabled={!canAddCondition(held)}
      onPick={(k) => actions.addCondition(k, step)}
    />
  );
  if (conditionsOnly) return <div>{addCondition}</div>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddActionButton
        body={body}
        where={branch ? 'branch' : 'list'}
        disabled={!canAddAction(body, step, kinds.branch?.max)}
        onPick={(k) => actions.addAction(k, { step, side })}
      />
      {branch ? addCondition : null}
    </div>
  );
}
