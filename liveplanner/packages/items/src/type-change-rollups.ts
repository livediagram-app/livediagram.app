// A Rollup's and Lookup's settings from an agent's change (docs/specs/026-plan/plan-agents.md "Changing card types";
// item-types.md "Rollup and Lookup fields"): `through`, `aggregate` and `source` by name, queued while the change adds
// its fields and resolved once the type (and the catalogue around it) holds them all, with the result they give.
// Anything that does not fit is refused with what would.
import { isLookupField, isRollupField } from './calculated-result';
import { AGGREGATES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import {
  AGGREGATE_LABELS,
  aggregateNeeds,
  aggregateOf,
  aggregateReads,
  lookupSourceOptions,
  lookupThroughOptions,
  rollupSettings,
  rollupSourceOptions,
  rollupThroughOptions,
} from './rollup-fields';
import { canShowAsPercent } from './percent-fields';
import { invalid } from './type-change-refused';

export interface RollupInput {
  through?: string;
  aggregate?: string;
  source?: string;
  // A Percent bar asked of a field whose result is only known once its settings resolve.
  showAs?: 'percent';
}

// Settings to resolve, by field id.
export type PendingRollups = Map<string, RollupInput>;

type Mutable = { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] };

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9#]/g, '');
const orList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs.join('');

// Queues a change's settings; on a field that is no Rollup or Lookup they are refused, and dropped from it.
export function withRollup(
  field: Mutable,
  input: Omit<RollupInput, 'showAs'>,
  pending: PendingRollups,
  isNew: boolean,
): void {
  const given =
    input.through !== undefined || input.aggregate !== undefined || input.source !== undefined;
  if (!isRollupField(field) && !isLookupField(field)) {
    if (given)
      throw invalid(
        `"${field.label}" is no rollup or lookup: only a calculated field whose calculation is rollup or lookup reads through a card field.`,
      );
    delete field.through;
    delete field.aggregate;
    delete field.source;
    return;
  }
  if (isLookupField(field)) delete field.aggregate;
  if (given || isNew) pending.set(field.id, { ...pending.get(field.id), ...input });
}

function named<T extends { id: string; label?: string; name?: string }>(
  wanted: string,
  options: readonly T[],
): T | undefined {
  const k = key(wanted);
  return options.find((o) => o.id === wanted || key(o.label ?? o.name ?? '') === k);
}

function aggregateNamed(field: string, wanted: string) {
  const k = key(wanted);
  const found = AGGREGATES.find((a) => key(a) === k || key(AGGREGATE_LABELS[a]) === k);
  if (!found)
    throw invalid(
      `"${field}" can't ${wanted}: give ${orList(AGGREGATES.map((a) => `${a} (${AGGREGATE_LABELS[a]})`))}.`,
    );
  return found;
}

// Each queued field's settings resolved against the type as the change leaves it, and its result taken from them.
export function resolveRollups(
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
  pending: PendingRollups,
): ItemTypeDef {
  if (pending.size === 0) return type;
  const all = types.map((t) => (t.id === type.id ? type : t));
  if (!all.some((t) => t.id === type.id)) all.push(type);
  const custom = (type.custom ?? []).map((f) => {
    const input = pending.get(f.id);
    if (!input) return f;
    const next: Mutable = { ...f };
    const rollup = isRollupField(f);
    if (input.aggregate !== undefined) next.aggregate = aggregateNamed(f.label, input.aggregate);
    if (input.through !== undefined) {
      const options = rollup ? rollupThroughOptions(type.id, all) : lookupThroughOptions(type);
      const all_ = rollup && ['', 'all', 'alllinkedcards', 'any'].includes(key(input.through));
      const found = all_ ? undefined : named(input.through, options);
      if (!all_ && !found)
        throw invalid(
          options.length
            ? `"${f.label}" can't read through "${input.through}": give ${orList([...(rollup ? ['all'] : []), ...options.map((o) => o.label)])}.`
            : rollup
              ? `"${f.label}" can't read through "${input.through}": no card field links to ${type.label}, so give all.`
              : `"${f.label}" needs a card field to read through: ${type.label} has none yet.`,
        );
      next.through = found?.id;
    }
    if (!rollup && !next.through) {
      const own = lookupThroughOptions(type);
      throw invalid(
        own.length
          ? `The lookup "${f.label}" needs through: ${orList(own.map((o) => o.label))}.`
          : `"${f.label}" needs a card field to read through: ${type.label} has none yet.`,
      );
    }
    const reads = rollup ? aggregateReads(aggregateOf(next)) : 'any';
    const options = rollup
      ? rollupSourceOptions(next, type.id, all)
      : lookupSourceOptions(next.through, type, all);
    if (reads !== 'none') {
      const wanted = input.source ?? next.source;
      const found = wanted === undefined ? undefined : named(wanted, options);
      if (!found) {
        const what = rollup ? aggregateNeeds(aggregateOf(next)) : 'a field of the linked card';
        const verb = rollup ? AGGREGATE_LABELS[aggregateOf(next)] : 'look up';
        throw invalid(
          wanted === undefined
            ? `"${f.label}" needs source: ${what}${options.length ? `, such as ${orList(options.slice(0, 6).map((o) => o.name))}` : ''}.`
            : `"${f.label}" can't ${verb} "${wanted}": give ${what}${options.length ? ` (${orList(options.slice(0, 6).map((o) => o.name))})` : ''}.`,
        );
      }
      next.source = found.id;
    }
    const settings = rollupSettings(next, type, all);
    for (const [k, v] of Object.entries(settings) as [keyof typeof settings, string | undefined][])
      if (v === undefined) delete next[k];
      else (next as Record<string, unknown>)[k] = v;
    if (!canShowAsPercent(next)) delete next.showAs;
    if (input.showAs === 'percent') {
      if (!canShowAsPercent(next))
        throw invalid(
          `"${f.label}" can't show as a percent: only a share, like Children Done or a Percent result, can.`,
        );
      next.showAs = 'percent';
    }
    return next;
  });
  pending.clear();
  return { ...type, custom };
}
