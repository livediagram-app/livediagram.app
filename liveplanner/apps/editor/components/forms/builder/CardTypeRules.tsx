'use client';

// Card Type by Answer (docs/specs/030-forms/forms.md "Choosing the card type by an answer"), under Responses Go To's
// column: rules that make another card type when an answer is one of some answers, each "When <question> is
// <answers>, make a <type> card in <column>", with its own answer-to-field mapping for that type. Closed until opened,
// and offered only while the board takes more than one type and the form has a question a rule may read, so a
// one-type destination reads as it always did. A broken rule says why, in amber, and the default type takes its
// responses until it is fixed.
import {
  destinationBoard,
  newFormPartId,
  newTypeRule,
  promptOf,
  ruleFieldChoices,
  ruleTarget,
  TYPE_RULE_PROBLEM_TEXT,
  TYPE_RULES_MAX,
  typeColumns,
  typeRuleProblem,
  typeRuleQuestions,
  typeRulesOffered,
  updateTypeRule,
  withTypeRules,
  type CardTypeRule,
  type RuleBoard,
} from '@liveplanner/forms';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import { PlusIcon, Select } from '@liveplanner/ui';
import { CUSTOM_KIND_LABELS } from '@/components/plan/ItemTypeFieldForms';
import { ColumnChips } from './ChoiceChip';
import { ADD, Row, Shell } from './fixed-value-parts';
import { RulePicker } from './SectionRule';
import { useFormBuilder } from './form-builder-context';

const LABEL = 'mb-1.5 text-[12px] text-slate-500 dark:text-slate-400';
const BROKEN = 'text-[12px] text-amber-800 dark:text-amber-200';

// `boards`: the board set-ups on the destination's tab; `takes`: the card types its board takes.
export function CardTypeRules({
  boards,
  takes,
}: {
  boards: readonly PlanBoardSetup[];
  takes: readonly ItemTypeDef[];
}) {
  const b = useFormBuilder();
  const dest = b.form.destination;
  const rules = dest?.typeRules ?? [];
  if (!dest || !b.type || (!rules.length && !typeRulesOffered(b.form, takes))) return null;
  const place = { types: b.types, boards };
  const board = destinationBoard(dest, boards) as (RuleBoard & PlanBoardSetup) | undefined;
  const broken = rules.some((r) => typeRuleProblem(r, b.form, place));
  const set = (next: readonly CardTypeRule[]) =>
    b.actions.changeForm((f) => withTypeRules(f, next));
  const patch = (id: string, p: Partial<Omit<CardTypeRule, 'id'>>) =>
    b.actions.changeForm((f) => updateTypeRule(f, id, p));
  const room =
    b.canEdit && rules.length < TYPE_RULES_MAX && !!newTypeRule(b.form, takes, board, 'r-0');
  return (
    <Shell
      title="Card Type by Answer"
      count={rules.length}
      hint={`An answer can make another card type. Every other answer makes a ${b.type.label} card.`}
      startOpen={broken}
    >
      {rules.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              board={board}
              takes={takes}
              onPatch={(p) => patch(rule.id, p)}
              onRemove={() => set(rules.filter((r) => r.id !== rule.id))}
              problem={typeRuleProblem(rule, b.form, place)}
            />
          ))}
        </ul>
      ) : null}
      {room ? (
        <button
          type="button"
          className={ADD}
          onClick={() => {
            const made = newTypeRule(b.form, takes, board, newFormPartId('r'));
            if (made) set([...rules, made]);
          }}
        >
          <PlusIcon size={13} />
          <span className="truncate">Add Rule</span>
        </button>
      ) : null}
    </Shell>
  );
}

function RuleRow({
  rule,
  board,
  takes,
  onPatch,
  onRemove,
  problem,
}: {
  rule: CardTypeRule;
  board: PlanBoardSetup | undefined;
  takes: readonly ItemTypeDef[];
  onPatch: (p: Partial<Omit<CardTypeRule, 'id'>>) => void;
  onRemove: () => void;
  problem: ReturnType<typeof typeRuleProblem>;
}) {
  const b = useFormBuilder();
  const questions = typeRuleQuestions(b.form);
  const q = questions.find((x) => x.id === rule.questionId) ?? null;
  const type = b.types.find((t) => t.id === rule.typeId);
  // The types this rule may make: the board's, but not the default's or another rule's.
  const others = new Set([
    b.form.destination?.typeId,
    ...(b.form.destination?.typeRules ?? []).filter((r) => r.id !== rule.id).map((r) => r.typeId),
  ]);
  const offered = takes.filter((t) => !others.has(t.id));
  const columns = board ? typeColumns(board.columns, type) : [];
  const disabled = !b.canEdit;
  return (
    <Row
      name={`${type?.label ?? 'A removed type'} Card`}
      onRemove={onRemove}
      removeLabel="Remove Rule"
      disabled={disabled}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">When</p>
          <RulePicker
            questions={questions}
            question={q}
            anyOf={rule.anyOf}
            answersLabel="is any of:"
            disabled={disabled}
            // A rule keeps at least one answer: unpicking the last one leaves it as it was.
            onChange={(questionId, anyOf) => anyOf.length && onPatch({ questionId, anyOf })}
          />
        </div>
        <div>
          <p className={LABEL}>make a</p>
          <Select
            aria-label="Card type"
            className="w-full"
            selectClassName="text-[13px]"
            value={type && offered.some((t) => t.id === type.id) ? type.id : ''}
            disabled={disabled}
            onChange={(e) => {
              const next = offered.find((t) => t.id === e.target.value);
              if (!next) return;
              // Fields belong to their type: a new type starts with none mapped, and its first column it uses.
              const status = board
                ? (typeColumns(board.columns, next).find((c) => c.status === rule.status)?.status ??
                  typeColumns(board.columns, next)[0]?.status ??
                  rule.status)
                : rule.status;
              onPatch({ typeId: next.id, status, fields: undefined });
            }}
          >
            <option value="" disabled>
              Choose a card type…
            </option>
            {offered.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {board && type ? (
          <div>
            <p className={LABEL}>card in</p>
            <div role="radiogroup" aria-label="Rule column" className="flex flex-wrap gap-1.5">
              <ColumnChips
                columns={columns}
                status={rule.status}
                disabled={disabled}
                onPick={(status) => onPatch({ status })}
              />
              {columns.length === 0 ? (
                <span className="text-[12px] text-slate-500 dark:text-slate-400">
                  None of these columns is a {type.label} state.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {problem ? <p className={BROKEN}>{TYPE_RULE_PROBLEM_TEXT[problem]}</p> : null}
        {type && !problem ? <RuleFields rule={rule} type={type} onPatch={onPatch} /> : null}
      </div>
    </Row>
  );
}

// Answers on {Type} Cards: each question that can go to one of the rule type's fields, a select of Description and
// those fields. Title is the form's: a question going to Title names every card, so it is not listed.
function RuleFields({
  rule,
  type,
  onPatch,
}: {
  rule: CardTypeRule;
  type: ItemTypeDef;
  onPatch: (p: Partial<Omit<CardTypeRule, 'id'>>) => void;
}) {
  const b = useFormBuilder();
  const rows = b.form.sections
    .flatMap((s) => s.questions)
    .filter((q) => q.goesTo?.to !== 'title')
    .map((q) => ({ q, choices: ruleFieldChoices(rule, q, type) }))
    .filter((r) => r.choices.length || rule.fields?.[r.q.id]);
  const map = (questionId: string, fieldId: string) => {
    const fields = Object.fromEntries(
      Object.entries(rule.fields ?? {}).filter(([id, f]) => id !== questionId && f !== fieldId),
    );
    if (fieldId) fields[questionId] = fieldId;
    onPatch({ fields });
  };
  return (
    <div>
      <p className={LABEL}>Answers on {type.label} cards</p>
      {rows.length ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ q, choices }) => {
            const target = ruleTarget(q, rule, type);
            return (
              <li key={q.id} className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                    {promptOf(q)}
                  </span>
                  <Select
                    aria-label={`${promptOf(q)} goes to`}
                    className="w-40 shrink-0 max-sm:w-44"
                    selectClassName="text-[12px]"
                    value={target.to === 'field' && target.field ? target.field.id : ''}
                    disabled={!b.canEdit}
                    onChange={(e) => map(q.id, e.target.value)}
                  >
                    <option value="">Description</option>
                    {choices.map(({ field, takenBy }) => (
                      <option key={field.id} value={field.id}>
                        {field.label} ({CUSTOM_KIND_LABELS[field.kind]}){takenBy ? ' · taken' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                {target.broken ? (
                  <p className={BROKEN}>
                    Goes to Description: its field was removed from {type.label} or no longer fits.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          No question fits one of {type.label}’s fields: answers go to Description (and Title).
        </p>
      )}
    </div>
  );
}
