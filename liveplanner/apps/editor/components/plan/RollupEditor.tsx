'use client';

// A Rollup's or Lookup's settings (docs/specs/026-plan/item-types.md "Rollup and Lookup fields", In the type editor),
// in place in the field's form: Through (the Card field it reads through), a Rollup's Calculate, the Field it reads
// (menus listing only what fits), a line saying what it works out, and the Preview on a real card. Every change takes
// the result from what it reads (rollupSettings), dropping a field that no longer fits and a Percent bar that no
// longer has a share to draw.
import { useId, useMemo } from 'react';
import {
  AGGREGATES,
  AGGREGATE_LABELS,
  ITEM_TYPES,
  aggregateNeeds,
  aggregateOf,
  aggregateReads,
  canShowAsPercent,
  isRollupField,
  lookupSourceOptions,
  lookupThroughOptions,
  rollupChildTypes,
  rollupSettings,
  rollupSourceOptions,
  rollupThroughOptions,
  typeIn,
  type Aggregate,
  type CustomFieldDef,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Select } from '@liveplanner/ui';
import { CalculatedPreview } from './CalculatedPreview';
import type { FormulaDraft } from './FormulaEditor';
import { usePlan } from './PlanContext';

const LABEL = 'text-[12px] font-medium text-slate-700 dark:text-slate-200';
const LINE = 'text-[11px] leading-snug text-slate-500 dark:text-slate-400';
// Through's value for every child (no `through`).
const EVERY_CHILD = '';

export type RollupDraftField = Omit<CustomFieldDef, 'id'> & Partial<Pick<CustomFieldDef, 'id'>>;
type RollupPatch = Partial<
  Pick<CustomFieldDef, 'through' | 'aggregate' | 'source' | 'result' | 'currency' | 'showAs'>
>;

// Verbs for the line under the menus: "Sums Points over ...".
const VERBS: Record<Aggregate, string> = {
  sum: 'Sums',
  average: 'Averages',
  min: 'Finds the smallest',
  max: 'Finds the largest',
  count: 'Counts',
  countDone: 'Counts the done ones of',
  earliest: 'Finds the earliest',
  latest: 'Finds the latest',
};

const andList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? '');

// The patch a change of settings makes: the settings, the result they give, and no Percent bar without a share.
export function rollupPatch(
  next: RollupDraftField,
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
): RollupPatch {
  const settings = rollupSettings(next, type, types);
  const options = isRollupField(next)
    ? rollupSourceOptions(settings, type.id, types)
    : lookupSourceOptions(settings.through, type, types);
  // A field that no longer fits is dropped: Add waits for another.
  const fits = settings.source !== undefined && options.some((o) => o.id === settings.source);
  const kept = fits
    ? settings
    : { ...settings, source: undefined, result: undefined, currency: undefined };
  const share = canShowAsPercent({ ...next, ...kept });
  return { ...kept, ...(share ? {} : { showAs: undefined }) };
}

export function RollupEditor({
  field,
  draft,
  onChange,
}: {
  field: RollupDraftField;
  draft: FormulaDraft;
  onChange: (patch: RollupPatch) => void;
}) {
  const ids = useId();
  const plan = usePlan();
  const saved = plan?.types ?? ITEM_TYPES;
  // The type as drafted, and the catalogue holding it, so a field added a moment ago can be read.
  const type: ItemTypeDef = useMemo(
    () => ({
      ...typeIn(saved, draft.typeId ?? ''),
      ...(draft.typeId ? { id: draft.typeId } : {}),
      fields: [...draft.fields],
      custom: [...draft.custom],
    }),
    [saved, draft.typeId, draft.fields, draft.custom],
  );
  const types = useMemo(
    () =>
      saved.some((t) => t.id === type.id)
        ? saved.map((t) => (t.id === type.id ? type : t))
        : [...saved, type],
    [saved, type],
  );
  const rollup = isRollupField(field);
  const aggregate = aggregateOf(field);
  const reads = rollup ? aggregateReads(aggregate) : 'any';
  const through = rollup
    ? rollupThroughOptions(type.id, types)
    : lookupThroughOptions(type).filter((o) => o.id !== field.id);
  const sources = rollup
    ? rollupSourceOptions(field, type.id, types)
    : lookupSourceOptions(field.through, type, types);
  const set = (patch: Partial<RollupDraftField>) =>
    onChange(rollupPatch({ ...field, ...patch }, type, types));

  // What it works out, in words, once it can.
  const sourceName = sources.find((s) => s.id === field.source)?.name;
  const throughName = through.find((o) => o.id === field.through)?.label;
  const children = rollup
    ? rollupChildTypes(type.id, field.through, types).map((t) => `${t.label} cards`)
    : [];
  const line = rollup
    ? through.length === 0
      ? 'No Link to Card field links here yet: link a card type to this one to roll its cards up.'
      : reads !== 'none' && !sourceName
        ? `Pick ${aggregateNeeds(aggregate)} to read.`
        : `${VERBS[aggregate]} ${reads === 'none' ? '' : `${sourceName} over `}the ${andList(children)} linking here${throughName ? ` through ${throughName}` : ''}.`
    : through.length === 0
      ? 'Add a Link to Card field first: a Lookup reads the card it links to.'
      : !throughName
        ? 'Pick the Link to Card field to read through.'
        : !sourceName
          ? `Pick a field of the card ${throughName} links to.`
          : `Shows ${sourceName} of the card ${throughName} links to.`;
  const ready =
    (rollup || !!throughName) &&
    (reads === 'none' || !!sourceName) &&
    (!rollup || through.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        {through.length > 0 ? (
          <label className="flex min-w-32 flex-1 flex-col gap-1">
            <span className={LABEL}>Through</span>
            <Select
              className="w-full"
              selectClassName="text-[13px]"
              value={field.through ?? EVERY_CHILD}
              onChange={(e) => set({ through: e.target.value || undefined })}
            >
              {rollup ? <option value={EVERY_CHILD}>All Linked Cards</option> : null}
              {!rollup && !field.through ? (
                <option value={EVERY_CHILD} disabled>
                  Pick a field
                </option>
              ) : null}
              {through.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        {rollup ? (
          <label className="flex min-w-28 flex-1 flex-col gap-1">
            <span className={LABEL}>Calculate</span>
            <Select
              className="w-full"
              selectClassName="text-[13px]"
              value={aggregate}
              onChange={(e) => set({ aggregate: e.target.value as Aggregate })}
            >
              {AGGREGATES.map((a) => (
                <option key={a} value={a}>
                  {AGGREGATE_LABELS[a]}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {reads !== 'none' && through.length > 0 && (rollup || field.through) ? (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Field</span>
          <Select
            className="w-full"
            selectClassName="text-[13px]"
            value={sourceName ? field.source : EVERY_CHILD}
            disabled={sources.length === 0}
            onChange={(e) => set({ source: e.target.value || undefined })}
          >
            {!sourceName ? (
              <option value={EVERY_CHILD} disabled>
                {sources.length ? 'Pick a field' : 'No field fits'}
              </option>
            ) : null}
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <p id={`${ids}-line`} role="status" className={LINE}>
        {line}
      </p>
      <CalculatedPreview
        typeId={draft.typeId}
        typeLabel={draft.typeId ? type.label : undefined}
        type={type}
        field={ready ? field : null}
        waiting={rollup ? 'Waiting for a field to read' : 'Waiting for a field to look up'}
        preferValue
      />
    </div>
  );
}
