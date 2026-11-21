'use client';

// The panel beside the steps (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): the selected step's
// fields, and for a step that writes text its Preview where the app has one. Nothing selected: a line saying to pick
// one. On a phone (`drawer`) the same panel is a sheet over the rule drawer (StepDrawer). It dispatches by kind: the
// steps every app has (If / Else, Wait, a message step) are drawn here, every other kind's fields are the panel its
// kit names for it (kit.kinds), under the Trigger, Condition or Action row that changes the kind.

import { AUTOMATION_NOTIFY_NAMES, type AutomationKind } from '@liveworkspace/automations';
import { actionGlyph, stepGlyph, StepTile, WaitGlyph, NOTIFY_GLYPHS } from './glyphs';
import { useItemConnections } from './item-connections';
import { useAutomationsKit } from './kit-context';
import { PanelOutlineProvider } from './rule-context';
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
import { StepDrawer } from './StepDrawer';
import { ChangeActionField } from './step-panels/ChangeActionField';
import { ChangeTriggerField } from './step-panels/ChangeTriggerField';
import { OutgoingPanel } from './step-panels/OutgoingPanel';
import { PanelField, PanelNote, PanelSelect } from './step-panels/panel-parts';
import { WaitPanel } from './step-panels/WaitPanel';
import { isIf, isOutgoing, isWait, stepKey, type RuleBody } from './types';

/** The refusal's path inside a part ('' for the part itself, 'text' for its text), or null when it names elsewhere. */
export function faultWithin(part: RulePart, faultPath: string | null): string | null {
  if (!faultPath) return null;
  const base = pathOf(part);
  if (faultPath === base) return '';
  return faultPath.startsWith(`${base}.`) ? faultPath.slice(base.length + 1) : null;
}

export function StepPanel<B extends RuleBody = RuleBody>({
  body,
  part,
  onChange: onBody,
  outline,
  faultPath,
  now,
  timeZone,
  drawer,
}: {
  body: B;
  part: RulePart | null;
  onChange: (next: B) => void;
  outline: unknown;
  faultPath: string | null;
  now: number;
  // The zone the rule is saved in (this browser's).
  timeZone: string;
  // On a phone: the panel is a sheet, and this closes it.
  drawer?: { onClose: () => void; fault?: string | null };
}) {
  const kit = useAutomationsKit();
  const { kinds } = kit;
  // The panels hold the rule openly (any app's kinds); what they hand back is the app's own, as they made it.
  const onChange = onBody as (next: RuleBody) => void;
  const hooks = useItemConnections();
  // A time rule or an incoming webhook's has nobody behind it: no "whoever triggered it".
  const personless = !!kinds.triggers[body.trigger.kind]?.personless;
  const Preview = kit.Preview;
  // `open`: the step the panel is for, so its fields' Insert a Value knows what stands before it.
  const shell = (
    title: string,
    tile: React.ReactNode,
    fields: React.ReactNode,
    open?: AutomationKind,
  ) => {
    // The fields' Insert a Value reads the item from here.
    const children = (
      <PanelOutlineProvider outline={outline} step={open}>
        {fields}
      </PanelOutlineProvider>
    );
    return drawer ? (
      <StepDrawer title={title} tile={tile} onClose={drawer.onClose} fault={drawer.fault ?? null}>
        {children}
      </StepDrawer>
    ) : (
      <section aria-label={`${title} step`} data-step-panel="" className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          {tile}
          {title}
        </h3>
        {children}
      </section>
    );
  };
  if (!part) return <PanelNote>Pick a step to change it, or add one under the steps.</PanelNote>;
  if (part.part === 'trigger') {
    const kind = kinds.triggers[body.trigger.kind];
    const Panel = kind?.Panel;
    return shell(
      'When',
      <StepTile tone="trigger" time={!!kind?.time} size={24} />,
      <div className="flex flex-col gap-4">
        <ChangeTriggerField
          kind={body.trigger.kind}
          onChange={(next) => {
            const fresh = kinds.triggers[next]?.fresh(outline, body.trigger);
            if (fresh) onChange({ ...body, trigger: fresh });
          }}
        />
        {Panel ? (
          <Panel
            trigger={body.trigger}
            outline={outline}
            timeZone={timeZone}
            conditions={body.conditions.length}
            onChange={(trigger) => onChange({ ...body, trigger })}
          />
        ) : null}
      </div>,
    );
  }
  if (part.part === 'condition') {
    const condition = conditionAt(body, part);
    if (!condition) return null;
    const kind = kinds.conditions[condition.kind];
    const Panel = kind?.Panel;
    return shell(
      kind?.name ?? '',
      <StepTile tone="condition" size={24} />,
      <div className="flex flex-col gap-4">
        <PanelField label="Condition">
          {(id) => (
            <PanelSelect
              id={id}
              value={condition.kind}
              onChange={(e) => {
                const fresh = kinds.conditions[e.target.value]?.fresh(outline);
                if (fresh) onChange(setCondition(body, part, fresh));
              }}
            >
              {/* One that reads whoever started the rule is not offered where nobody did (kept while it is the
                  condition's own kind, to be changed). */}
              {Object.keys(kinds.conditions)
                .filter(
                  (k) => k === condition.kind || !personless || !kinds.conditions[k]?.personal,
                )
                .map((k) => (
                  <option key={k} value={k}>
                    {kinds.conditions[k]!.name}
                  </option>
                ))}
            </PanelSelect>
          )}
        </PanelField>
        {Panel ? (
          <Panel
            condition={condition}
            outline={outline}
            onChange={(c) => onChange(setCondition(body, part, c))}
          />
        ) : null}
      </div>,
    );
  }
  const step = part.part === 'step' ? body.steps[part.index] : actionAt(body, part);
  if (!step) return null;
  const top = part.part === 'step';
  // Change offers what Add Action offers where the step stands: at the top level, judged against the rest of the
  // rule (what is full), one nothing may follow only for the last step.
  const rest = top ? { ...body, steps: body.steps.filter((_, j) => j !== part.index) } : null;
  const last = !top || part.index === body.steps.length - 1;
  const freshAt = (index: number) => (next: string) => {
    const fresh = kinds.actions[next]?.fresh(outline, { personless });
    if (fresh) onChange(setStep(body, index, fresh));
  };
  if (isIf(step))
    return shell(
      'If / Else',
      <StepTile tone="action" glyph={actionGlyph(kit, 'if')} size={24} />,
      <PanelNote>
        Its conditions decide which list runs: Then when they all hold, Else when any does not. Add
        to each under the step.
      </PanelNote>,
    );
  const branch = kinds.branch;
  if (branch && step.kind === branch.kind) {
    if (!top) return null;
    return shell(
      branch.name,
      <StepTile tone="action" glyph={branch.glyph} size={24} />,
      <branch.Panel
        step={step}
        outline={outline}
        onChange={(next) => onChange(setStep(body, part.index, next))}
      />,
    );
  }
  if (isOutgoing(step)) {
    if (!top) return null;
    const name = hooks?.connections.find((w) => w.id === step.webhook)?.name ?? step.name;
    return shell(
      AUTOMATION_NOTIFY_NAMES[step.via],
      <StepTile tone="action" glyph={NOTIFY_GLYPHS[step.via]} size={24} />,
      <>
        <OutgoingPanel
          step={step}
          change={{ rest: rest!, last, onKind: freshAt(part.index) }}
          invalidPath={faultWithin(part, faultPath)}
          onChange={(next) => onChange(setStep(body, part.index, next))}
        />
        {Preview ? (
          <Preview
            text={step.text}
            body={body}
            outline={outline}
            now={now}
            branch={false}
            via={name ? `To ${name}` : undefined}
          />
        ) : null}
      </>,
      step,
    );
  }
  if (isWait(step)) {
    if (!top) return null;
    return shell(
      kinds.actions.wait?.name ?? 'Wait',
      <StepTile tone="action" glyph={WaitGlyph} size={24} />,
      <WaitPanel step={step} onChange={(next) => onChange(setStep(body, part.index, next))} />,
    );
  }
  const key = stepKey(step);
  const kind = kinds.actions[key];
  // A step of the top level alone never sits inside a holder.
  if (kind?.top && !top) return null;
  const Panel = kind?.Panel;
  const inBranch = !!branch && holderOf(body, part)?.kind === branch.kind;
  const text = kit.previewText?.(step) ?? null;
  const set = (next: typeof step) =>
    onChange(top ? setStep(body, part.index, next) : setBranchAction(body, part, next));
  return shell(
    kind?.name ?? '',
    <StepTile tone="action" glyph={stepGlyph(kit, step)} size={24} />,
    <>
      <div className="flex flex-col gap-4">
        {kind?.fixed ? null : (
          <ChangeActionField
            actionKey={key}
            where={top ? 'top' : inBranch ? 'branch' : 'list'}
            rest={rest}
            last={last}
            onChange={(next) => {
              const fresh = kinds.actions[next]?.fresh(outline, { personless });
              if (fresh) set(fresh);
            }}
          />
        )}
        {Panel ? (
          <Panel
            action={step}
            outline={outline}
            invalidPath={faultWithin(part, faultPath)}
            branch={inBranch}
            personless={personless}
            onChange={set}
          />
        ) : kind?.note ? (
          <PanelNote>{kind.note}</PanelNote>
        ) : null}
      </div>
      {Preview && text !== null ? (
        <Preview text={text} body={body} outline={outline} now={now} branch={inBranch} />
      ) : null}
    </>,
    step,
  );
}
