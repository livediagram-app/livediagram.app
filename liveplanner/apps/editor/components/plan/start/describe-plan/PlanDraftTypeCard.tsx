'use client';

// One card type in Describe a Plan's preview (docs/specs/026-plan/describe-a-plan.md "The preview"): its glyph and
// colour, its name, the built-in fields it shows (chips, each removable), and its own fields as rows (the name, the
// kind, a Choice's options as chips, a remove button), Add Field while it has fewer than eight, and Remove Type. A type
// named as one the plan already has is drawn read-only, the plan's own fields shown, since Make Plan keeps the plan's.

import { useEffect, useRef } from 'react';
import {
  BUILT_IN_FIELD_NAMES,
  CUSTOM_CHOICE_OPTION_MAX,
  CUSTOM_FIELD_LABEL_MAX,
  ITEM_TYPE_LABEL_MAX,
  PLAN_DRAFT_FIELD_KINDS,
  PLAN_DRAFT_FIELDS_MAX,
  PLAN_DRAFT_OPTIONS_MAX,
  type ItemTypeDef,
  type PlanDraftField,
  type PlanDraftFieldKind,
  type PlanDraftType,
} from '@liveplanner/items';
import {
  Button,
  CloseIcon,
  PlusIcon,
  Select,
  TextInput,
  Tooltip,
  TrashIcon,
} from '@liveplanner/ui';
import { CardTypeTile } from '@/components/plan/CardTypeTile';
import { CUSTOM_KIND_LABELS } from '@/components/plan/ItemTypeFieldForms';
import { NameChips, ProblemText } from './NameChips';
import { freshName, holdsOptions, withKind } from './draft-edits';

const LABEL = 'text-[12px] font-medium text-slate-500 dark:text-slate-400';
const CHIP =
  'flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 text-[12px] text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';

export function PlanDraftTypeCard({
  type,
  index,
  kept,
  problemAt,
  onChange,
  onRemove,
}: {
  type: PlanDraftType;
  index: number;
  // The plan's own type of this name: Make Plan keeps it as it is, so the draft's is drawn read-only.
  kept: ItemTypeDef | undefined;
  problemAt: (path: string) => string | undefined;
  onChange: (next: PlanDraftType) => void;
  onRemove: () => void;
}) {
  const at = `cardTypes.${index}`;
  const name = type.name.trim() || `Card Type ${index + 1}`;
  const nameProblem = problemAt(`${at}.name`);
  const fieldsProblem = problemAt(`${at}.fields`);
  const fieldsBox = useRef<HTMLDivElement>(null);
  // The count before the last Add Field: a row beyond it is new, and its name takes focus, selected.
  const added = useRef<number | null>(null);
  useEffect(() => {
    if (added.current === null || type.fields.length <= added.current) return;
    const inputs = fieldsBox.current?.querySelectorAll<HTMLInputElement>('input[data-field-name]');
    const fresh = inputs?.[type.fields.length - 1];
    fresh?.focus();
    fresh?.select();
    added.current = null;
  }, [type.fields.length]);
  const setField = (j: number, field: PlanDraftField) =>
    onChange({ ...type, fields: type.fields.map((f, k) => (k === j ? field : f)) });
  return (
    <section
      aria-label={`Card type ${name}`}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2.5">
        <CardTypeTile color={type.color} glyph={type.glyph} size={26} />
        {kept ? (
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
            {kept.label}
          </span>
        ) : (
          <TextInput
            compact
            aria-label={`Card type ${index + 1} name`}
            aria-invalid={nameProblem ? true : undefined}
            invalid={!!nameProblem}
            value={type.name}
            maxLength={ITEM_TYPE_LABEL_MAX}
            onChange={(e) => onChange({ ...type, name: e.target.value })}
            className="min-w-0 flex-1 font-semibold"
          />
        )}
        <Tooltip label={`Remove ${name}`}>
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="shrink-0"
          >
            <TrashIcon size={14} aria-hidden />
            <span className="max-sm:hidden">Remove Type</span>
          </Button>
        </Tooltip>
      </div>
      {nameProblem ? <ProblemText>{nameProblem}</ProblemText> : null}
      {kept ? (
        <KeptType type={kept} />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Shows</span>
            <div className="flex flex-wrap gap-1.5">
              {type.builtInFields.map((f) => (
                <span key={f} className={CHIP}>
                  {BUILT_IN_FIELD_NAMES[f]}
                  <Tooltip label={`Remove ${BUILT_IN_FIELD_NAMES[f]}`}>
                    <button
                      type="button"
                      aria-label={`Remove ${BUILT_IN_FIELD_NAMES[f]}`}
                      onClick={() =>
                        onChange({
                          ...type,
                          builtInFields: type.builtInFields.filter((x) => x !== f),
                        })
                      }
                      className="flex size-5 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none pointer-coarse:size-8 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <CloseIcon size={11} />
                    </button>
                  </Tooltip>
                </span>
              ))}
              {type.builtInFields.length === 0 ? (
                <span className="text-[12px] text-slate-500 dark:text-slate-400">
                  Title and Status only
                </span>
              ) : null}
            </div>
          </div>
          <div ref={fieldsBox} className="flex flex-col gap-2">
            <span className={LABEL}>Fields</span>
            {type.fields.length === 0 ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Add a field for anything else its cards should hold.
              </p>
            ) : null}
            {type.fields.map((field, j) => (
              <FieldRow
                key={j}
                field={field}
                path={`${at}.fields.${j}`}
                problemAt={problemAt}
                onChange={(next) => setField(j, next)}
                onRemove={() =>
                  onChange({ ...type, fields: type.fields.filter((_, k) => k !== j) })
                }
              />
            ))}
            {fieldsProblem ? <ProblemText>{fieldsProblem}</ProblemText> : null}
            {type.fields.length < PLAN_DRAFT_FIELDS_MAX ? (
              <div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    added.current = type.fields.length;
                    onChange({
                      ...type,
                      fields: [
                        ...type.fields,
                        {
                          name: freshName(
                            'New Field',
                            type.fields.map((f) => f.name),
                          ),
                          kind: 'text',
                        },
                      ],
                    });
                  }}
                >
                  <PlusIcon size={12} aria-hidden />
                  Add Field
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

// A type the plan already has: what it is, and the fields it holds.
function KeptType({ type }: { type: ItemTypeDef }) {
  const own = (type.custom ?? []).map((f) => f.label);
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Already in this plan: yours is kept as it is.
      </p>
      {own.length ? (
        <div className="flex flex-wrap gap-1.5">
          {own.map((label) => (
            <span key={label} className={`${CHIP} pr-2.5`}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  field,
  path,
  problemAt,
  onChange,
  onRemove,
}: {
  field: PlanDraftField;
  path: string;
  problemAt: (path: string) => string | undefined;
  onChange: (next: PlanDraftField) => void;
  onRemove: () => void;
}) {
  const nameProblem = problemAt(`${path}.name`);
  const kindProblem = problemAt(`${path}.kind`);
  const optionsProblem = problemAt(`${path}.options`);
  const label = field.name.trim() || 'this field';
  const options = field.options ?? [];
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          compact
          data-field-name=""
          aria-label="Field name"
          aria-invalid={nameProblem ? true : undefined}
          invalid={!!nameProblem}
          value={field.name}
          maxLength={CUSTOM_FIELD_LABEL_MAX}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          className="min-w-0 flex-1 basis-40"
        />
        <Select
          aria-label={`Kind of ${label}`}
          value={field.kind}
          onChange={(e) => onChange(withKind(field, e.target.value as PlanDraftFieldKind))}
          className="w-40 max-sm:flex-1"
          selectClassName="py-1.5 text-[13px]"
        >
          {PLAN_DRAFT_FIELD_KINDS.map((k) => (
            <option key={k} value={k}>
              {CUSTOM_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Tooltip label={`Remove ${label}`}>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none pointer-coarse:size-10 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <CloseIcon size={14} />
          </button>
        </Tooltip>
      </div>
      {nameProblem ? <ProblemText>{nameProblem}</ProblemText> : null}
      {kindProblem ? <ProblemText>{kindProblem}</ProblemText> : null}
      {holdsOptions(field.kind) ? (
        <div className="flex flex-col gap-1 pl-0.5">
          <span className="text-[12px] text-slate-500 dark:text-slate-400">Options</span>
          <NameChips
            names={options}
            noun="Option"
            size="sm"
            max={PLAN_DRAFT_OPTIONS_MAX}
            maxLength={CUSTOM_CHOICE_OPTION_MAX}
            problemAt={(k) => problemAt(`${path}.options.${k}`)}
            onRename={(k, v) =>
              onChange({ ...field, options: options.map((o, x) => (x === k ? v : o)) })
            }
            onRemove={(k) => onChange({ ...field, options: options.filter((_, x) => x !== k) })}
            onAdd={() =>
              onChange({
                ...field,
                options: [...options, freshName(`Option ${options.length + 1}`, options)],
              })
            }
          />
          {optionsProblem ? <ProblemText>{optionsProblem}</ProblemText> : null}
        </div>
      ) : null}
    </div>
  );
}
