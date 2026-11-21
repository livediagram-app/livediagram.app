'use client';

// The rule as a column of steps (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): When, each
// condition (If all of these, or for a time trigger what it runs on), each step (Then), joined by a line, and + Add
// Action, + Add Condition, + If / Else and the app's branch under them. An If / Else holds its own conditions and its
// Then and Else lists; a branch its own conditions and actions; each inset under it with its own add buttons. Every
// step but the trigger has a ⋯ menu. A step a template left to pick says so until it is picked. The words on each
// card are the app's (kit.sentence).

import {
  AUTOMATION_AI_PER_DAY,
  waitWords,
  type AutomationKind,
  type RuleSentencePart,
} from '@liveworkspace/automations';
import { actionGlyph, stepGlyph } from './glyphs';
import { useAutomationsKit } from './kit-context';
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
import { isAi, isIf, isOutgoing, isWait, stepKey, type RuleBody } from './types';
import { ChipText, useValueLabels, valueText } from './value-labels';
import { ValueChipsText } from './ValueInsert';

// The trigger's card is labelled When already: a kit whose trigger words open on it (liveplanner's) drops it there.
const withoutWhen = (parts: readonly RuleSentencePart[]): readonly RuleSentencePart[] => {
  const first = parts[0];
  return first && 'word' in first && first.word === 'When' ? parts.slice(1) : parts;
};

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

export function RuleSteps({
  body,
  outline,
  selected,
  fault,
  actions,
  picks,
  moved = null,
  onMovedFocused,
}: {
  body: RuleBody;
  outline: unknown;
  selected: RulePart | null;
  // The step a refusal names, and why.
  fault: { part: RulePart; message: string } | null;
  actions: StepsActions;
  // What a template left to pick, by the path of the part it sits on ("steps.0" → "Pick a connection").
  picks?: ReadonlyMap<string, string> | undefined;
  // The step a move just put in its new place, whose ⋯ takes focus, and the word that it has.
  moved?: RulePart | null;
  onMovedFocused?: () => void;
}) {
  const kit = useAutomationsKit();
  const { sentence, kinds } = kit;
  const branch = kinds.branch;
  // A value in a chip reads as its label in a token (Take Snapshot “Today”), and in the names menus read.
  const labels = useValueLabels(outline);
  const stepName = (a: AutomationKind) => valueText(sentence.step(a, outline), labels);
  // A step nothing may follow stays last: it never moves up, and the step before it never moves down past it.
  const endsRule = (step: AutomationKind | undefined) =>
    !!step && !!kinds.actions[stepKey(step)]?.last;
  const mayMove = (part: RulePart, dir: 'up' | 'down') => {
    if (!canMove(body, part, dir)) return false;
    if (part.part !== 'step') return true;
    return dir === 'up' ? !endsRule(body.steps[part.index]) : !endsRule(body.steps[part.index + 1]);
  };
  // What a step does: its chip, and under it the text it writes (a comment, a message, an email's subject).
  const stepBody = (a: AutomationKind) => {
    if (isWait(a))
      return (
        <>
          <span className={`${CHIP} self-start`}>{waitWords(a.hours)}</span>
          <span className={QUIET}>The steps after it run when the time is up</span>
        </>
      );
    if (isAi(a))
      return (
        <>
          <span className={`${CHIP} self-start`}>
            <ChipText text={sentence.step(a, outline)} labels={labels} />
          </span>
          <span className={QUIET}>Uses AI: counts toward {AUTOMATION_AI_PER_DAY} a day</span>
        </>
      );
    const sub = isOutgoing(a) ? a.text : (sentence.text?.(a) ?? '');
    return (
      <>
        <span className={`${CHIP} self-start`}>
          <ChipText text={sentence.step(a, outline)} labels={labels} />
        </span>
        {sub ? <ValueChipsText text={sub} className={SUB} /> : null}
      </>
    );
  };
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
            canUp={mayMove(part, 'up')}
            canDown={mayMove(part, 'down')}
            canDuplicate={canDuplicate(body, part, branch?.max)}
            onEdit={(edit) => actions.edit(part, edit)}
            takeFocus={samePart(moved, part)}
            onFocused={onMovedFocused}
          />
        ) : undefined
      }
    />
  );
  const conditionCard = (part: RulePart & { part: 'condition' }, label: string) => {
    const holder = part.ifStep === undefined ? undefined : (body.steps[part.ifStep] as HolderStep);
    const name = sentence.condition((holder ?? body).conditions[part.index]!, outline);
    return card(
      part,
      {
        tone: 'condition',
        label,
        children: (
          <span className={`${CHIP} self-start`}>
            <ChipText text={name} labels={labels} />
          </span>
        ),
      },
      valueText(name, labels),
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
      {(step.else ? (['then', 'else'] as const) : (['then'] as const)).map((side) => {
        const list = (side === 'else' ? step.else : step.then) ?? [];
        const label = side === 'then' ? 'Then' : 'Else';
        return (
          <div key={side} className="flex flex-col gap-2">
            {step.else ? <span className={SIDE_HEAD}>{label}</span> : null}
            {list.map((a, j) => (
              <div key={`${side}${j}`}>
                {card(
                  { part: 'branch', step: i, side, index: j },
                  { tone: 'action', glyph: stepGlyph(kit, a), label, children: stepBody(a) },
                  stepName(a),
                )}
              </div>
            ))}
            <HolderAddButtons body={body} step={i} side={side} actions={actions} />
          </div>
        );
      })}
      {step.else ? (
        <HolderAddButtons body={body} step={i} side="then" actions={actions} conditionsOnly />
      ) : null}
    </div>
  );

  const time = !!kinds.triggers[body.trigger.kind]?.time;
  const TriggerNote = sentence.TriggerNote;
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
                <SentenceChips
                  parts={withoutWhen(sentence.trigger(body.trigger, outline))}
                  labels={labels}
                />
                {TriggerNote ? <TriggerNote body={body} compact /> : null}
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
            i > 0 ? 'And' : time ? sentence.picksLabel : 'If all of these',
          )}
        </li>
      ))}
      {body.steps.map((step, i) => {
        const part: RulePart = { part: 'step', index: i };
        const name = stepName(step);
        if (isIf(step))
          return (
            <li key={`s${i}`}>
              <StepJoin />
              {card(
                part,
                {
                  tone: 'action',
                  glyph: actionGlyph(kit, 'if'),
                  label: 'If / Else',
                  children:
                    step.conditions.length === 0 ? (
                      <span className={QUIET}>Add a condition to decide.</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {step.conditions.map((c, j) => (
                          <span key={j} className={IF_CHIP}>
                            <ChipText text={sentence.condition(c, outline)} labels={labels} />
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
        if (branch && step.kind === branch.kind) {
          const held = step as unknown as HolderStep;
          return (
            <li key={`s${i}`} data-branch-step="">
              <StepJoin />
              {card(
                part,
                {
                  tone: 'action',
                  glyph: branch.glyph,
                  label: branch.name,
                  children: (
                    <>
                      {branch.card(step, name, outline)}
                      {held.then.length === 0 ? (
                        <span className={QUIET}>{branch.empty}</span>
                      ) : null}
                    </>
                  ),
                },
                name,
              )}
              {inset(held, i)}
            </li>
          );
        }
        return (
          <li key={`s${i}`}>
            <StepJoin />
            {card(
              part,
              {
                tone: 'action',
                glyph: stepGlyph(kit, step),
                label: 'Then',
                children: stepBody(step),
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
