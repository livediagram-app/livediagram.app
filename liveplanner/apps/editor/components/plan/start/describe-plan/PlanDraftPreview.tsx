'use client';

// Check Your Plan, Describe a Plan's preview (docs/specs/026-plan/describe-a-plan.md "The preview"): the violet Drafted
// by AI note, the board (its name, its columns as chips), each card type (PlanDraftTypeCard) and the starter rules
// (PlanDraftRules), every problem said beside its place. A column, card type or field renamed is renamed in the rules
// that name it. What it shows is what Make Plan makes; nothing is made here.

import {
  PLAN_COLUMN_NAME_MAX,
  PLAN_COLUMNS_MAX,
  PLAN_DRAFT_TYPES_MAX,
  PLAN_TITLE_MAX,
  statusKey,
  withColumnName,
  withFieldName,
  withTypeName,
  type ItemTypeDef,
  type PlanDraft,
  type PlanDraftType,
} from '@liveplanner/items';
import { Button, PlusIcon, TextInput } from '@liveplanner/ui';
import { AiNote } from '@/components/automations/step-panels/AiStepPanel';
import { NameChips, ProblemText } from './NameChips';
import { PlanDraftRules } from './PlanDraftRules';
import { PlanDraftTypeCard } from './PlanDraftTypeCard';
import { freshName, newDraftType } from './draft-edits';

const HEADING =
  'text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

// Type `i` changed: a renamed type or field renamed in the rules too, then the type as the card left it.
function withType(draft: PlanDraft, i: number, next: PlanDraftType): PlanDraft {
  const prev = draft.cardTypes[i]!;
  let out = prev.name === next.name ? draft : withTypeName(draft, i, next.name);
  if (prev.fields.length === next.fields.length)
    for (const [j, f] of next.fields.entries())
      if (f.name !== prev.fields[j]!.name) out = withFieldName(out, i, j, f.name);
  return { ...out, cardTypes: out.cardTypes.map((t, k) => (k === i ? next : t)) };
}

export function PlanDraftPreview({
  draft,
  planTypes,
  rulesMade,
  problemAt,
  onChange,
  titleId,
}: {
  draft: PlanDraft;
  // The plan's own card types: a drafted type named as one of them is kept as the plan has it.
  planTypes: readonly ItemTypeDef[];
  // Whether Make Plan can make the starter rules (Automations' gate: a plan saved to an account).
  rulesMade: boolean;
  problemAt: (path: string) => string | undefined;
  onChange: (next: PlanDraft) => void;
  titleId: string;
}) {
  const titleProblem = problemAt('title');
  const columnsProblem = problemAt('columns');
  const typesProblem = problemAt('cardTypes');
  const keptOf = (name: string) => planTypes.find((t) => statusKey(t.label) === statusKey(name));
  return (
    <div className="flex flex-col gap-5">
      <AiNote>
        <strong className="font-semibold">Drafted by AI.</strong> Change anything you like. Nothing
        is made until you press Make Plan.
      </AiNote>
      <section aria-labelledby={`${titleId}-board`} className="flex flex-col gap-3">
        <h3 id={`${titleId}-board`} className={HEADING}>
          Board
        </h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Name</span>
          <TextInput
            compact
            aria-invalid={titleProblem ? true : undefined}
            invalid={!!titleProblem}
            value={draft.title}
            maxLength={PLAN_TITLE_MAX}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </label>
        {titleProblem ? <ProblemText>{titleProblem}</ProblemText> : null}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Columns
            <span className="tabular-nums font-normal">
              {draft.columns.length} of {PLAN_COLUMNS_MAX}
            </span>
          </span>
          <NameChips
            names={draft.columns}
            noun="Column"
            max={PLAN_COLUMNS_MAX}
            maxLength={PLAN_COLUMN_NAME_MAX}
            problemAt={(i) => problemAt(`columns.${i}`)}
            onRename={(i, name) => onChange(withColumnName(draft, i, name))}
            onRemove={(i) =>
              onChange({ ...draft, columns: draft.columns.filter((_, k) => k !== i) })
            }
            onAdd={() =>
              onChange({
                ...draft,
                columns: [...draft.columns, freshName('New Column', draft.columns)],
              })
            }
          />
          {columnsProblem ? <ProblemText>{columnsProblem}</ProblemText> : null}
        </div>
      </section>
      <section aria-labelledby={`${titleId}-types`} className="flex flex-col gap-3">
        <h3 id={`${titleId}-types`} className={HEADING}>
          Card Types
        </h3>
        {typesProblem ? <ProblemText>{typesProblem}</ProblemText> : null}
        {draft.cardTypes.map((type, i) => (
          <PlanDraftTypeCard
            // Index keys: a type is its place in the list, and its name changes as it is typed.
            key={i}
            type={type}
            index={i}
            kept={keptOf(type.name)}
            problemAt={problemAt}
            onChange={(next) => onChange(withType(draft, i, next))}
            onRemove={() =>
              onChange({ ...draft, cardTypes: draft.cardTypes.filter((_, k) => k !== i) })
            }
          />
        ))}
        {draft.cardTypes.length < PLAN_DRAFT_TYPES_MAX ? (
          <div>
            <Button
              variant="secondary"
              size="xs"
              onClick={() =>
                onChange({ ...draft, cardTypes: [...draft.cardTypes, newDraftType(draft)] })
              }
            >
              <PlusIcon size={12} aria-hidden />
              Add Card Type
            </Button>
          </div>
        ) : null}
      </section>
      <PlanDraftRules
        draft={draft}
        planTypes={planTypes}
        made={rulesMade}
        problemAt={problemAt}
        onChange={(rules) => onChange({ ...draft, rules })}
        titleId={titleId}
      />
    </div>
  );
}
