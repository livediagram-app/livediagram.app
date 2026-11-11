'use client';

// The rule as a column of steps (docs/specs/026-plan/automations.md "The rule builder"): When, each condition (If all
// of these), each action (Then), joined by a line, and + Add Action, + Add Condition and + If / Else under them. An
// If / Else step holds its own conditions and its Then and Else lists, each with its own add buttons. Every step but
// the trigger has a ⋯ menu.

import { useState } from 'react';
import {
  AUTOMATION_CONDITION_NAMES,
  AUTOMATION_STEP_NAMES,
  actionChip,
  conditionChip,
  stepChip,
  triggerParts,
  type AutomationAction,
  type AutomationActionKind,
  type AutomationCondition,
  type AutomationRuleBody,
} from '@liveplanner/items';
import { Button, PlusIcon } from '@liveplanner/ui';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { AutomationOutline } from './automation-outline';
import { ConditionIcon, StepTile } from './automation-glyphs';
import {
  canAddAction,
  canAddCondition,
  canMove,
  pathOf,
  samePart,
  type RulePart,
  type StepEdit,
} from './rule-draft';
import { CHIP, SentenceChips } from './SentenceChips';
import { ACTION_KINDS, CONDITION_KINDS } from './step-defaults';
import { StepCard, StepJoin } from './StepCard';
import { StepMenu } from './StepMenu';
import { ValueChipsText } from './ValueInsert';

export type StepsActions = {
  select: (part: RulePart) => void;
  edit: (part: RulePart, edit: StepEdit) => void;
  addCondition: (kind: AutomationCondition['kind'], ifStep?: number) => void;
  addAction: (kind: AutomationActionKind, branch?: { step: number; side: 'then' | 'else' }) => void;
  addIfElse: () => void;
};

/** A dashed add button that opens a menu of kinds. */
function AddMenu<K extends string>({
  label,
  kinds,
  names,
  icon,
  disabled,
  onPick,
}: {
  label: string;
  kinds: readonly K[];
  names: Readonly<Record<K, string>>;
  icon: (kind: K) => React.ReactNode;
  disabled: boolean;
  onPick: (kind: K) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        className="border-dashed"
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
          {kinds.map((k) => (
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
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}

// An If / Else's own conditions, in the condition tone.
const IF_CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-orange-50 px-2 py-px text-[12px] font-medium leading-[18px] text-orange-800 dark:bg-orange-500/15 dark:text-orange-200';

const actionIcon = (k: AutomationActionKind) => <StepTile tone="action" kind={k} size={24} />;
const conditionIcon = () => <ConditionIcon />;

function AddButtons({
  body,
  ifStep,
  branch,
  actions,
  withIf,
}: {
  body: AutomationRuleBody;
  ifStep?: number;
  branch?: { step: number; side: 'then' | 'else' };
  actions: StepsActions;
  withIf: boolean;
}) {
  const conditions =
    ifStep === undefined
      ? body.conditions
      : (() => {
          const s = body.steps[ifStep];
          return s?.kind === 'if' ? s.conditions : [];
        })();
  const full = !canAddAction(body);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddMenu
        label="Add Action"
        kinds={ACTION_KINDS}
        names={AUTOMATION_STEP_NAMES}
        icon={actionIcon}
        disabled={full}
        onPick={(k) => actions.addAction(k, branch)}
      />
      {branch ? null : (
        <AddMenu
          label="Add Condition"
          kinds={CONDITION_KINDS}
          names={AUTOMATION_CONDITION_NAMES}
          icon={conditionIcon}
          disabled={!canAddCondition(conditions)}
          onPick={(k) => actions.addCondition(k, ifStep)}
        />
      )}
      {withIf ? (
        <Button
          variant="secondary"
          size="xs"
          className="border-dashed"
          disabled={full}
          onClick={actions.addIfElse}
        >
          <PlusIcon size={12} />
          If / Else
        </Button>
      ) : null}
    </div>
  );
}

export function RuleSteps({
  body,
  outline,
  selected,
  fault,
  actions,
}: {
  body: AutomationRuleBody;
  outline: AutomationOutline;
  selected: RulePart | null;
  // The step a refusal names, and why.
  fault: { part: RulePart; message: string } | null;
  actions: StepsActions;
}) {
  const faultFor = (part: RulePart) => (fault && samePart(fault.part, part) ? fault.message : null);
  const card = (
    part: RulePart,
    props: Omit<Parameters<typeof StepCard>[0], 'selected' | 'fault' | 'onSelect' | 'menu'>,
    menuName?: string,
  ) => (
    <StepCard
      {...props}
      selected={samePart(selected, part)}
      fault={faultFor(part)}
      onSelect={() => actions.select(part)}
      menu={
        menuName ? (
          <StepMenu
            name={menuName}
            canUp={canMove(body, part, 'up')}
            canDown={canMove(body, part, 'down')}
            canDuplicate={part.part === 'condition' || canAddAction(body)}
            onEdit={(edit) => actions.edit(part, edit)}
          />
        ) : undefined
      }
    />
  );
  const actionBody = (a: AutomationAction) => (
    <>
      <span className={`${CHIP} self-start`}>{actionChip(a, outline)}</span>
      {a.kind === 'comment' && a.text ? (
        <ValueChipsText text={a.text} className="text-[12px] text-slate-600 dark:text-slate-300" />
      ) : null}
      {a.kind === 'email' && a.subject ? (
        <ValueChipsText
          text={a.subject}
          className="text-[12px] text-slate-600 dark:text-slate-300"
        />
      ) : null}
    </>
  );

  return (
    <ol aria-label="Steps" className="flex flex-col">
      <li key="trigger">
        {card(
          { part: 'trigger' },
          {
            tone: 'trigger',
            label: 'When',
            children: <SentenceChips parts={triggerParts(body.trigger, outline)} />,
          },
        )}
      </li>
      {body.conditions.map((c, i) => {
        const part: RulePart = { part: 'condition', index: i };
        return (
          <li key={`c${pathOf(part)}`}>
            <StepJoin />
            {card(
              part,
              {
                tone: 'condition',
                label: i === 0 ? 'If all of these' : 'And',
                children: <span className={`${CHIP} self-start`}>{conditionChip(c, outline)}</span>,
              },
              conditionChip(c, outline),
            )}
          </li>
        );
      })}
      {body.steps.map((step, i) => {
        const part: RulePart = { part: 'step', index: i };
        const name = stepChip(step, outline);
        if (step.kind !== 'if')
          return (
            <li key={`s${i}`}>
              <StepJoin />
              {card(
                part,
                { tone: 'action', kind: step.kind, label: 'Then', children: actionBody(step) },
                name,
              )}
            </li>
          );
        return (
          <li key={`s${i}`}>
            <StepJoin />
            {card(
              part,
              {
                tone: 'action',
                kind: 'if',
                label: 'If / Else',
                children:
                  step.conditions.length === 0 ? (
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      Add a condition to decide.
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {step.conditions.map((c, j) => (
                        <span key={j} className={IF_CHIP}>
                          {conditionChip(c, outline)}
                        </span>
                      ))}
                    </span>
                  ),
              },
              name,
            )}
            <div className="ml-[31px] mt-2 flex flex-col gap-3 border-l-2 border-slate-200 pl-5 dark:border-slate-700">
              {step.conditions.map((c, j) => {
                const cp: RulePart = { part: 'condition', index: j, ifStep: i };
                return (
                  <div key={`ic${j}`}>
                    {card(
                      cp,
                      {
                        tone: 'condition',
                        label: j === 0 ? 'If' : 'And',
                        children: (
                          <span className={`${CHIP} self-start`}>{conditionChip(c, outline)}</span>
                        ),
                      },
                      conditionChip(c, outline),
                    )}
                  </div>
                );
              })}
              {(['then', 'else'] as const).map((side) => (
                <div key={side} className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {side === 'then' ? 'Then' : 'Else'}
                  </span>
                  {step[side].map((a, j) => {
                    const bp: RulePart = { part: 'branch', step: i, side, index: j };
                    return (
                      <div key={`${side}${j}`}>
                        {card(
                          bp,
                          {
                            tone: 'action',
                            kind: a.kind,
                            label: side === 'then' ? 'Then' : 'Else',
                            children: actionBody(a),
                          },
                          actionChip(a, outline),
                        )}
                      </div>
                    );
                  })}
                  <AddButtons
                    body={body}
                    branch={{ step: i, side }}
                    actions={actions}
                    withIf={false}
                  />
                </div>
              ))}
              <div>
                <AddMenu
                  label="Add Condition to If"
                  kinds={CONDITION_KINDS}
                  names={AUTOMATION_CONDITION_NAMES}
                  icon={conditionIcon}
                  disabled={!canAddCondition(step.conditions)}
                  onPick={(k) => actions.addCondition(k, i)}
                />
              </div>
            </div>
          </li>
        );
      })}
      <li key="add" className="pt-4">
        <AddButtons body={body} actions={actions} withIf />
      </li>
    </ol>
  );
}
