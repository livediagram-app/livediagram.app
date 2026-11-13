'use client';

// Starter Rules in Describe a Plan's preview (docs/specs/026-plan/describe-a-plan.md "The preview", "Starter rules"):
// up to two Automations rules drafted with the plan, each a card with its On switch, its name, its sentence as the
// Rules list draws it (in the draft's words, so a renamed column reads renamed) and Remove Rule. Nothing is made here:
// Make Plan makes the rules left in. On a plan in This Browser, where Automations can't run, the section says the
// rules are left out instead.

import { useMemo } from 'react';
import {
  AUTOMATION_NAME_MAX,
  planDraftRuleSentence,
  planDraftRuleView,
  type ItemTypeDef,
  type PlanDraft,
  type PlanDraftRule,
} from '@liveplanner/items';
import { Button, Switch, TextInput, Tooltip, TrashIcon } from '@liveplanner/ui';
import { SentenceChips } from '@/components/automations/SentenceChips';
import { ProblemText } from './NameChips';

export const STARTER_RULES_LINE =
  'Made with the plan in Automations, where you can change them later.';
export const STARTER_RULES_LEFT_OUT =
  'Starter rules need this plan saved to your account, so these are left out. Sync the plan, then add rules in Automations.';

const HEADING =
  'text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function PlanDraftRules({
  draft,
  planTypes,
  made,
  problemAt,
  onChange,
  titleId,
}: {
  draft: PlanDraft;
  planTypes: readonly ItemTypeDef[];
  // Whether Make Plan can make them: a plan saved to an account, an Editor signed in (Automations' own gate).
  made: boolean;
  problemAt: (path: string) => string | undefined;
  onChange: (rules: PlanDraftRule[]) => void;
  titleId: string;
}) {
  const rules = draft.rules ?? [];
  // The draft as the rules name it: read once per change, for every rule's sentence.
  const view = useMemo(() => planDraftRuleView(draft, planTypes), [draft, planTypes]);
  if (rules.length === 0) return null;
  const headingId = `${titleId}-rules`;
  return (
    <section aria-labelledby={headingId} data-starter-rules="" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className={HEADING}>
          Starter Rules
        </h3>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {made ? STARTER_RULES_LINE : STARTER_RULES_LEFT_OUT}
        </p>
      </div>
      {made
        ? rules.map((rule, i) => (
            <RuleCard
              // Index keys: a rule is its place in the list, and its name changes as it is typed.
              key={i}
              rule={rule}
              index={i}
              sentence={planDraftRuleSentence(rule, view)}
              problemAt={problemAt}
              onChange={(next) => onChange(rules.map((r, k) => (k === i ? next : r)))}
              onRemove={() => onChange(rules.filter((_, k) => k !== i))}
            />
          ))
        : null}
    </section>
  );
}

function RuleCard({
  rule,
  index,
  sentence,
  problemAt,
  onChange,
  onRemove,
}: {
  rule: PlanDraftRule;
  index: number;
  sentence: ReturnType<typeof planDraftRuleSentence>;
  problemAt: (path: string) => string | undefined;
  onChange: (next: PlanDraftRule) => void;
  onRemove: () => void;
}) {
  const at = `rules.${index}`;
  const name = rule.name.trim() || `Rule ${index + 1}`;
  const nameProblem = problemAt(`${at}.name`);
  const ruleProblem = problemAt(at);
  return (
    <section
      aria-label={`Starter rule ${name}`}
      data-starter-rule={index}
      className={`flex flex-col gap-2.5 rounded-xl border bg-white p-3 transition-colors motion-reduce:transition-none sm:p-4 dark:bg-slate-900 ${
        ruleProblem
          ? 'border-rose-300 dark:border-rose-400/50'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Tooltip
          label={
            rule.on
              ? 'Made on: it runs once the plan is made'
              : 'Made off: turn it on in Automations'
          }
        >
          <span className="flex shrink-0">
            <Switch
              size="sm"
              checked={rule.on}
              label={`Make ${name} on`}
              onChange={(on) => onChange({ ...rule, on })}
            />
          </span>
        </Tooltip>
        <TextInput
          compact
          aria-label={`Rule ${index + 1} name`}
          aria-invalid={nameProblem ? true : undefined}
          invalid={!!nameProblem}
          value={rule.name}
          maxLength={AUTOMATION_NAME_MAX}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className={`min-w-0 flex-1 font-semibold ${rule.on ? '' : 'text-slate-500 dark:text-slate-400'}`}
        />
        <Tooltip label={`Remove ${name}`}>
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="shrink-0"
          >
            <TrashIcon size={14} aria-hidden />
            <span className="max-sm:hidden">Remove Rule</span>
          </Button>
        </Tooltip>
      </div>
      {nameProblem ? <ProblemText>{nameProblem}</ProblemText> : null}
      <SentenceChips parts={sentence} className={rule.on ? '' : 'opacity-70'} />
      {ruleProblem ? <ProblemText>{ruleProblem}</ProblemText> : null}
    </section>
  );
}
