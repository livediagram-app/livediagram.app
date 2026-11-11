'use client';

// The panel beside the steps (docs/specs/026-plan/automations.md "The rule builder"): the selected step's fields,
// read from the plan's own pickers, and for a comment or an email its Preview. Nothing selected: a line saying to pick
// one. On a phone it opens under the steps.

import {
  AUTOMATION_CONDITION_NAMES,
  AUTOMATION_NOTIFY_NAMES,
  AUTOMATION_STEP_NAMES,
  isTimeTrigger,
  type AutomationRuleBody,
} from '@liveplanner/items';
import type { AutomationOutline } from './automation-outline';
import { StepTile } from './automation-glyphs';
import { usePlanWebhooks } from './plan-webhooks';
import {
  actionAt,
  conditionAt,
  holderOf,
  pathOf,
  setBranchAction,
  setCondition,
  setStep,
  type RulePart,
} from './rule-draft';
import { StepPreview } from './StepPreview';
import { ActionPanel } from './step-panels/ActionPanel';
import { BranchPanel } from './step-panels/BranchPanel';
import { ConditionPanel } from './step-panels/ConditionPanel';
import { OutgoingPanel } from './step-panels/OutgoingPanel';
import { PanelNote } from './step-panels/panel-parts';
import { TriggerPanel } from './step-panels/TriggerPanel';

/** The refusal's path inside a part ('' for the part itself, 'text' for its text), or null when it names elsewhere. */
export function faultWithin(part: RulePart, faultPath: string | null): string | null {
  if (!faultPath) return null;
  const base = pathOf(part);
  if (faultPath === base) return '';
  return faultPath.startsWith(`${base}.`) ? faultPath.slice(base.length + 1) : null;
}

export function StepPanel({
  body,
  part,
  onChange,
  outline,
  faultPath,
  person,
  now,
  timeZone,
}: {
  body: AutomationRuleBody;
  part: RulePart | null;
  onChange: (next: AutomationRuleBody) => void;
  outline: AutomationOutline;
  faultPath: string | null;
  person: string;
  now: number;
  // The zone the rule is saved in (this browser's).
  timeZone: string;
}) {
  const hooks = usePlanWebhooks();
  const timeRule = isTimeTrigger(body.trigger);
  const shell = (title: string, tile: React.ReactNode, children: React.ReactNode) => (
    <section aria-label={`${title} step`} data-step-panel="" className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
        {tile}
        {title}
      </h3>
      {children}
    </section>
  );
  if (!part) return <PanelNote>Pick a step to change it, or add one under the steps.</PanelNote>;
  if (part.part === 'trigger')
    return shell(
      'When',
      <StepTile tone="trigger" time={timeRule} size={24} />,
      <TriggerPanel
        trigger={body.trigger}
        outline={outline}
        timeZone={timeZone}
        conditions={body.conditions.length}
        onChange={(trigger) => onChange({ ...body, trigger })}
      />,
    );
  if (part.part === 'condition') {
    const condition = conditionAt(body, part);
    if (!condition) return null;
    return shell(
      AUTOMATION_CONDITION_NAMES[condition.kind],
      <StepTile tone="condition" size={24} />,
      <ConditionPanel
        condition={condition}
        outline={outline}
        onChange={(c) => onChange(setCondition(body, part, c))}
      />,
    );
  }
  const step = part.part === 'step' ? body.steps[part.index] : actionAt(body, part);
  if (!step) return null;
  if (step.kind === 'if')
    return shell(
      AUTOMATION_STEP_NAMES.if,
      <StepTile tone="action" kind="if" size={24} />,
      <PanelNote>
        Its conditions decide which list runs: Then when they all hold, Else when any does not. Add
        to each under the step.
      </PanelNote>,
    );
  if (step.kind === 'for' && part.part === 'step')
    return shell(
      AUTOMATION_STEP_NAMES.for,
      <StepTile tone="action" kind="for" size={24} />,
      <BranchPanel
        step={step}
        outline={outline}
        onChange={(next) => onChange(setStep(body, part.index, next))}
      />,
    );
  if (step.kind === 'notify' && part.part === 'step') {
    const name = hooks?.webhooks.find((w) => w.id === step.webhook)?.name ?? step.name;
    return shell(
      AUTOMATION_NOTIFY_NAMES[step.via],
      <StepTile tone="action" kind="notify" via={step.via} size={24} />,
      <>
        <OutgoingPanel
          step={step}
          outline={outline}
          invalidPath={faultWithin(part, faultPath)}
          onChange={(next) => onChange(setStep(body, part.index, next))}
        />
        <StepPreview
          text={step.text}
          outline={outline}
          rule={body.name}
          person={person}
          now={now}
          via={name ? `To ${name}` : undefined}
        />
      </>,
    );
  }
  if (step.kind === 'for' || step.kind === 'notify') return null;
  const branch = holderOf(body, part)?.kind === 'for';
  const text = step.kind === 'comment' ? step.text : step.kind === 'email' ? step.body : null;
  return shell(
    AUTOMATION_STEP_NAMES[step.kind],
    <StepTile tone="action" kind={step.kind} size={24} />,
    <>
      <ActionPanel
        action={step}
        outline={outline}
        invalidPath={faultWithin(part, faultPath)}
        branch={branch}
        timeRule={timeRule}
        onChange={(a) =>
          onChange(
            part.part === 'step' ? setStep(body, part.index, a) : setBranchAction(body, part, a),
          )
        }
      />
      {text !== null ? (
        <StepPreview
          text={text}
          outline={outline}
          rule={body.name}
          person={person}
          now={now}
          branch={branch}
        />
      ) : null}
    </>,
  );
}
