'use client';

// The rule as a column of steps (docs/specs/026-plan/automations.md "The rule builder"): When, each condition (If all
// of these, or for a time trigger the cards it runs on), each step (Then), joined by a line, and + Add Action, + Add
// Condition, + If / Else and + For Related Cards under them. An If / Else holds its own conditions and its Then and
// Else lists; a For Related Cards branch ("For each Blocked By Card") its own conditions and actions; each inset under
// it with its own add buttons. Every step but the trigger has a ⋯ menu. A time rule with no conditions warns that it
// runs on every card; a step a template left to pick says so until it is picked.

import {
  AUTOMATION_RELATED_NAMES,
  actionChip,
  conditionChip,
  isTimeTrigger,
  notifyChip,
  stepChip,
  triggerParts,
  type AutomationAction,
  type AutomationOutgoing,
  type AutomationRuleBody,
  type RuleSentenceOutline,
} from '@liveplanner/items';
import type { AutomationOutline } from './automation-outline';
import {
  canDuplicate,
  canMove,
  pathOf,
  samePart,
  type HolderStep,
  type RulePart,
  type StepEdit,
} from './rule-draft';
import { CHIP, SentenceChips } from './SentenceChips';
import { HolderAddButtons, TopAddButtons, type AddActions } from './StepAddButtons';
import { StepCard, StepJoin } from './StepCard';
import { StepMenu } from './StepMenu';
import { EveryCardWarning } from './step-panels/TimeTriggerPanel';
import { ValueChipsText } from './ValueInsert';

export type StepsActions = AddActions & {
  select: (part: RulePart) => void;
  edit: (part: RulePart, edit: StepEdit) => void;
};

// An If / Else's own conditions, in the condition tone.
const IF_CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-orange-50 px-2 py-px text-[12px] font-medium leading-[18px] text-orange-800 dark:bg-orange-500/15 dark:text-orange-200';
const INSET =
  'ml-[31px] mt-2 flex flex-col gap-3 border-l-2 border-slate-200 pl-5 dark:border-slate-700';
const SIDE_HEAD =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const SUB = 'text-[12px] text-slate-600 dark:text-slate-300';
const QUIET = 'text-[12px] text-slate-500 dark:text-slate-400';

type CardProps = Omit<
  Parameters<typeof StepCard>[0],
  'selected' | 'fault' | 'pick' | 'onSelect' | 'menu'
>;

// What a step does: its chip, and under it the text it writes (a comment, a message, an email's subject).
function stepBody(a: AutomationAction | AutomationOutgoing, outline: RuleSentenceOutline) {
  const sub =
    a.kind === 'comment' || a.kind === 'notify' ? a.text : a.kind === 'email' ? a.subject : '';
  return (
    <>
      <span className={`${CHIP} self-start`}>
        {a.kind === 'notify' ? notifyChip(a, outline) : actionChip(a, outline)}
      </span>
      {sub ? <ValueChipsText text={sub} className={SUB} /> : null}
    </>
  );
}

export function RuleSteps({
  body,
  outline,
  selected,
  fault,
  actions,
  picks,
}: {
  body: AutomationRuleBody;
  outline: AutomationOutline;
  selected: RulePart | null;
  // The step a refusal names, and why.
  fault: { part: RulePart; message: string } | null;
  actions: StepsActions;
  // What a template left to pick, by the path of the part it sits on ("steps.0" → "Pick a webhook").
  picks?: ReadonlyMap<string, string> | undefined;
}) {
  const faultFor = (part: RulePart) => (fault && samePart(fault.part, part) ? fault.message : null);
  const card = (part: RulePart, props: CardProps, menuName?: string) => (
    <StepCard
      {...props}
      selected={samePart(selected, part)}
      fault={faultFor(part)}
      pick={picks?.get(pathOf(part)) ?? null}
      onSelect={() => actions.select(part)}
      menu={
        menuName ? (
          <StepMenu
            name={menuName}
            canUp={canMove(body, part, 'up')}
            canDown={canMove(body, part, 'down')}
            canDuplicate={canDuplicate(body, part)}
            onEdit={(edit) => actions.edit(part, edit)}
          />
        ) : undefined
      }
    />
  );
  const conditionCard = (part: RulePart & { part: 'condition' }, label: string) => {
    const holder = part.ifStep === undefined ? undefined : (body.steps[part.ifStep] as HolderStep);
    const name = conditionChip((holder ?? body).conditions[part.index]!, outline);
    return card(
      part,
      { tone: 'condition', label, children: <span className={`${CHIP} self-start`}>{name}</span> },
      name,
    );
  };

  // A holder's own conditions and actions, inset under it: an If's Then and Else, a branch's Then.
  const inset = (step: HolderStep, i: number) => (
    <div className={INSET}>
      {step.conditions.map((_, j) => (
        <div key={`c${j}`}>
          {conditionCard({ part: 'condition', index: j, ifStep: i }, j === 0 ? 'If' : 'And')}
        </div>
      ))}
      {(step.kind === 'if' ? (['then', 'else'] as const) : (['then'] as const)).map((side) => {
        const list = side === 'else' && step.kind === 'if' ? step.else : step.then;
        const label = side === 'then' ? 'Then' : 'Else';
        return (
          <div key={side} className="flex flex-col gap-2">
            {step.kind === 'if' ? <span className={SIDE_HEAD}>{label}</span> : null}
            {list.map((a, j) => (
              <div key={`${side}${j}`}>
                {card(
                  { part: 'branch', step: i, side, index: j },
                  { tone: 'action', kind: a.kind, label, children: stepBody(a, outline) },
                  actionChip(a, outline),
                )}
              </div>
            ))}
            <HolderAddButtons body={body} step={i} side={side} actions={actions} />
          </div>
        );
      })}
      {step.kind === 'if' ? (
        <HolderAddButtons body={body} step={i} side="then" actions={actions} conditionsOnly />
      ) : null}
    </div>
  );

  const time = isTimeTrigger(body.trigger);
  return (
    <ol aria-label="Steps" className="flex flex-col">
      <li key="trigger">
        {card(
          { part: 'trigger' },
          {
            tone: 'trigger',
            time,
            label: 'When',
            children: (
              <>
                <SentenceChips parts={triggerParts(body.trigger, outline)} />
                {time && body.conditions.length === 0 ? <EveryCardWarning compact /> : null}
              </>
            ),
          },
        )}
      </li>
      {body.conditions.map((_, i) => (
        <li key={`c${i}`}>
          <StepJoin />
          {conditionCard(
            { part: 'condition', index: i },
            i > 0 ? 'And' : time ? 'For cards where' : 'If all of these',
          )}
        </li>
      ))}
      {body.steps.map((step, i) => {
        const part: RulePart = { part: 'step', index: i };
        const name = stepChip(step, outline);
        if (step.kind === 'if')
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
                      <span className={QUIET}>Add a condition to decide.</span>
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
              {inset(step, i)}
            </li>
          );
        if (step.kind === 'for')
          return (
            <li key={`s${i}`} data-branch-step="">
              <StepJoin />
              {card(
                part,
                {
                  tone: 'action',
                  kind: 'for',
                  label: 'For Related Cards',
                  children: (
                    <>
                      <span className="flex flex-wrap items-center gap-1 text-[13px] font-medium">
                        For each
                        <span className={CHIP}>
                          {name.slice('For each '.length) ||
                            AUTOMATION_RELATED_NAMES[step.related.kind]}
                        </span>
                      </span>
                      {step.then.length === 0 ? (
                        <span className={QUIET}>Add an action to run on each one.</span>
                      ) : null}
                    </>
                  ),
                },
                name,
              )}
              {inset(step, i)}
            </li>
          );
        return (
          <li key={`s${i}`}>
            <StepJoin />
            {card(
              part,
              {
                tone: 'action',
                kind: step.kind,
                via: step.kind === 'notify' ? step.via : undefined,
                label: 'Then',
                children: stepBody(step, outline),
              },
              name,
            )}
          </li>
        );
      })}
      <li key="add" className="pt-4">
        <TopAddButtons body={body} actions={actions} />
      </li>
    </ol>
  );
}
