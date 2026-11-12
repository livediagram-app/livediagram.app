// A card type's custom fields as a change makes and edits them (docs/specs/026-plan/plan-agents.md "Changing card
// types"): kinds, options, card links, currencies, calculations, formulas, Show As and the switches each kind allows.
import { withArticle } from './indefinite-article';
import { CALCULATION_LABELS } from './calculated-fields';
import { isFormulaField } from './formula-fields';
import { FORMULA_RESULTS, FORMULA_RESULT_DEFAULT } from './formula/limits';
import { formulaScopeOf, storedFormula } from './formula/references';
import { canShowAsPercent } from './percent-fields';
import { isTimeSpent } from './duration-fields';
import { isLookupField, isRollupField } from './calculated-result';
import { invalid } from './type-change-refused';
import { withRollup, type PendingRollups } from './type-change-rollups';
import {
  COMMON_CURRENCIES,
  CURRENCY_CODE,
  CURRENCY_DEFAULT,
  CALCULATIONS,
  OFFERED_FIELD_KINDS,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  type CustomFieldDef,
  type ItemTypeDef,
  withLinkTypes,
  type Calculation,
} from './item-types';
import { fieldKeyOf, resolveType } from './plan-names';
import { statusKey } from './status-names';
import { newCustomFieldId } from './type-catalogue';
import { canBeRequired } from './required-fields';
import { holdsSeveralKind } from './several-values';
import { must, withoutOnDetailed } from './type-change-parts';
import type { CustomFieldEdit, CustomFieldInput } from './type-change-inputs';

// Card types named by id or name, as ids, each once: never more than the catalogue holds, so never past
// CARD_LINK_TYPES_MAX.
function cardTypeIds(names: readonly string[], types: readonly ItemTypeDef[]): string[] {
  return [...new Set(names.map((n) => must(resolveType(n, types)).type.id))];
}

export function editedCustom(
  type: ItemTypeDef,
  edit: CustomFieldEdit,
  types: readonly ItemTypeDef[],
  formulas: PendingFormulas,
  rollups: PendingRollups,
): ItemTypeDef {
  const key = must(fieldKeyOf(edit.field, type)).key;
  const field = (type.custom ?? []).find((f) => f.id === key);
  if (!field)
    throw invalid(`"${edit.field}" is a built-in field: only custom fields are edited here.`);
  const next: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] } = { ...field };
  if (edit.name !== undefined) {
    const name = edit.name.trim();
    if ((type.custom ?? []).some((f) => f.id !== key && statusKey(f.label) === statusKey(name)))
      throw invalid(`${type.label} already has a field "${name}".`);
    next.label = name;
  }
  if (edit.options) {
    if (field.kind !== 'choice' && field.kind !== 'multichoice')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a choice or multichoice field has options.`,
      );
    next.options = edit.options.map((o) => o.trim());
  }
  if (edit.linkTypes) {
    if (field.kind !== 'card')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a card field links to card types.`,
      );
    if (edit.linkTypes.length === 0)
      throw invalid(`"${field.label}" needs at least one card type to link to.`);
    // Replaced whole: a list of one drops the stored list.
    delete next.linkTypes;
    Object.assign(next, withLinkTypes(next, cardTypeIds(edit.linkTypes, types)));
  }
  if (edit.currency) {
    if (field.kind !== 'currency' && !isFormulaField(field))
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a currency field has a currency.`,
      );
    const code = currencyOf(edit.currency);
    if (code === CURRENCY_DEFAULT) delete next.currency;
    else next.currency = code;
  }
  if (edit.calculation !== undefined) {
    if (field.kind !== 'calculated')
      throw invalid(
        `"${field.label}" is ${withArticle(field.kind)} field: only a calculated field has a calculation.`,
      );
    next.calculation = calculationNamed(field.label, edit.calculation);
  }
  withFormula(next, edit, formulas, field.formula === undefined);
  withRollup(next, edit, rollups, next.calculation !== field.calculation);
  // A Child Count, or a Formula whose result is no longer a Percent, is no share: it stops showing as a Percent.
  if (!canShowAsPercent(next)) delete next.showAs;
  if (
    edit.showAs !== undefined &&
    (isRollupField(next) || isLookupField(next)) &&
    rollups.has(key)
  ) {
    // Its result is known once its settings resolve (resolveRollups).
    if (showAsWanted(edit.showAs)) rollups.set(key, { ...rollups.get(key), showAs: 'percent' });
    else delete next.showAs;
  } else if (edit.showAs !== undefined) {
    if (showAsNamed(next, edit.showAs)) next.showAs = 'percent';
    else delete next.showAs;
  }
  if (edit.onCard === true) next.onCard = true;
  if (edit.onCard === false) delete next.onCard;
  if (edit.required === true) next.required = requirable(field);
  if (edit.required === false) delete next.required;
  if (edit.notifies === true) next.notifies = notifiable(field);
  if (edit.notifies === false) delete next.notifies;
  if (edit.multiple === true) next.multiple = severalable(field);
  if (edit.multiple === false) delete next.multiple;
  if (edit.blocks === true) {
    next.blocks = blockable(field);
    next.multiple = true;
  }
  if (edit.blocks === false) delete next.blocks;
  const edited = { ...type, custom: (type.custom ?? []).map((f) => (f.id === key ? next : f)) };
  // Unticked, it leaves a Detailed Display of the type's own too.
  return edit.onCard === false ? withoutOnDetailed(edited, key) : edited;
}

function currencyOf(input: string): string {
  const code = input.trim().toUpperCase();
  if (CURRENCY_CODE.test(code)) return code;
  throw invalid(
    `"${input}" is not a currency code. Give an ISO 4217 code, for example ${COMMON_CURRENCIES.join(', ')}.`,
  );
}

export function customOf(
  input: CustomFieldInput,
  type: ItemTypeDef,
  types: readonly ItemTypeDef[],
  formulas: PendingFormulas,
  rollups: PendingRollups,
): CustomFieldDef {
  const typed = input.kind
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  // An American agent's "color" is the Colour kind.
  const kind = typed === 'color' ? 'colour' : typed;
  const known = OFFERED_FIELD_KINDS.find((k) => k === kind);
  if (!known)
    throw invalid(
      `"${input.kind}" is not a custom field kind. Kinds: ${OFFERED_FIELD_KINDS.join(', ')}.`,
    );
  const name = input.name.trim();
  if ((type.custom ?? []).some((f) => statusKey(f.label) === statusKey(name)))
    throw invalid(`${type.label} already has a field "${name}".`);
  const field: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] } = {
    id: newCustomFieldId(name, [...type.fields, ...(type.custom ?? []).map((f) => f.id)]),
    label: name,
    kind: known,
  };
  if (known === 'choice' || known === 'multichoice')
    field.options = (input.options ?? []).map((o) => o.trim());
  if (known === 'rating' && input.scale !== undefined) {
    if (
      !Number.isInteger(input.scale) ||
      input.scale < RATING_FIELD_SCALE_MIN ||
      input.scale > RATING_FIELD_SCALE_MAX
    )
      throw invalid(
        `A rating's scale is a whole number from ${RATING_FIELD_SCALE_MIN} to ${RATING_FIELD_SCALE_MAX}.`,
      );
    if (input.scale !== RATING_FIELD_SCALE_DEFAULT) field.scale = input.scale;
  }
  if (known === 'card') {
    const named = [...(input.linkType ? [input.linkType] : []), ...(input.linkTypes ?? [])];
    if (named.length === 0)
      throw invalid(
        `The Card field "${name}" needs linkTypes: the card types it links to (or linkType, one).`,
      );
    Object.assign(field, withLinkTypes(field, cardTypeIds(named, types)));
  }
  if (known === 'calculated') field.calculation = calculationNamed(name, input.calculation);
  else if (input.calculation !== undefined)
    throw invalid(
      `"${name}" is ${withArticle(known)} field: only a calculated field has a calculation.`,
    );
  withFormula(field, input, formulas, true);
  withRollup(field, input, rollups, true);
  if ((known === 'currency' || field.result === 'currency') && input.currency) {
    const code = currencyOf(input.currency);
    if (code !== CURRENCY_DEFAULT) field.currency = code;
  }
  if (input.showAs !== undefined && rollups.has(field.id)) {
    if (showAsWanted(input.showAs))
      rollups.set(field.id, { ...rollups.get(field.id), showAs: 'percent' });
  } else if (input.showAs !== undefined && showAsNamed(field, input.showAs))
    field.showAs = 'percent';
  if (input.timeSpent) {
    if (known !== 'duration')
      throw invalid(`"${name}" is ${withArticle(known)} field: only a duration field tracks time.`);
    field.timeSpent = true;
  }
  if (input.withTime) {
    if (known !== 'daterange')
      throw invalid(
        `"${name}" is ${withArticle(known)} field: only a date range field has times on its ends.`,
      );
    field.withTime = true;
  }
  if (input.onCard) field.onCard = true;
  if (input.required) field.required = requirable(field);
  if (input.notifies) field.notifies = notifiable(field);
  if (input.multiple) field.multiple = severalable(field);
  if (input.blocks) {
    field.blocks = blockable(field);
    field.multiple = true;
  }
  return field;
}

// Formulas written with names this change still has to store with ids, by field id: resolved once the type holds
// every field the change adds (resolveFormulas), so a formula may name a field added after it.
export type PendingFormulas = Map<string, string>;

const resultKey = (s: string) => s.trim().toLowerCase();

// A Formula's settings from a change (docs/specs/026-plan/item-types.md "Formula fields"): its result kind and its
// expression (queued for resolveFormulas); refused on a field that is no Formula, and a new Formula needs one.
function withFormula(
  field: { -readonly [K in keyof CustomFieldDef]: CustomFieldDef[K] },
  input: { formula?: string; result?: string },
  formulas: PendingFormulas,
  needsFormula: boolean,
): void {
  const formula = isFormulaField(field);
  if (!formula) {
    if (input.formula !== undefined || input.result !== undefined)
      throw invalid(
        `"${field.label}" is no formula: only a calculated field whose calculation is formula has one.`,
      );
    delete field.formula;
    // A Rollup's or Lookup's result is its own, taken from what it reads (resolveRollups).
    if (!isRollupField(field) && !isLookupField(field)) {
      delete field.result;
      if (field.kind !== 'currency') delete field.currency;
    }
    return;
  }
  if (input.result !== undefined) {
    const result = FORMULA_RESULTS.find((r) => r === resultKey(input.result!));
    if (!result) throw invalid(`A formula's result is one of ${FORMULA_RESULTS.join(', ')}.`);
    if (result === FORMULA_RESULT_DEFAULT) delete field.result;
    else field.result = result;
    if (result !== 'currency') delete field.currency;
  }
  if (input.formula !== undefined) formulas.set(field.id, input.formula);
  else if (needsFormula)
    throw invalid(
      `The formula field "${field.label}" needs a formula, written with field names: "Budget - Spent".`,
    );
}

// Each queued formula stored with ids against the type as the change leaves it; a field the change removed is
// skipped, and a formula that can't be read is refused with its problem.
export function resolveFormulas(type: ItemTypeDef, formulas: PendingFormulas): ItemTypeDef {
  if (formulas.size === 0) return type;
  const scope = formulaScopeOf(type);
  const custom = (type.custom ?? []).map((f) => {
    const text = formulas.get(f.id);
    if (text === undefined) return f;
    const stored = storedFormula(text, scope, f.id);
    if (!stored.ok) throw invalid(`The formula for "${f.label}" doesn't work: ${stored.error}.`);
    return { ...f, formula: stored.formula };
  });
  formulas.clear();
  return { ...type, custom };
}

// "a, b or c".
const orList = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs.join('');

// Whether `showAs` asks for a Percent, before the field's result is known (a Rollup's or Lookup's).
function showAsWanted(named: string): boolean {
  const key = named.toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'number' || key === 'text') return false;
  if (key !== 'percent' && key !== 'percentbar')
    throw invalid(`"${named}" is not a way to show a field: give percent or number.`);
  return true;
}

// Whether `showAs` asks for a Percent: 'percent' (or "Percent Bar"), on a field whose result is a share; 'number'
// asks for text. Anything else, or a Percent asked of a field that gives no share, is refused.
function showAsNamed(
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'result' | 'label'>,
  named: string,
): boolean {
  const key = named.toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'number' || key === 'text') return false;
  if (key !== 'percent' && key !== 'percentbar')
    throw invalid(`"${named}" is not a way to show a field: give percent or number.`);
  if (!canShowAsPercent(field))
    throw invalid(
      `"${field.label}" can't show as a percent: only a share, like Children Done or a Percent formula, can.`,
    );
  return true;
}

// A calculation as an agent names it: its id (`childCount`) or its name ("Child Count"), any case or spacing.
const calcKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
function calculationNamed(field: string, named: string | undefined): Calculation {
  const key = calcKey(named ?? '');
  const found = CALCULATIONS.find(
    (c) => calcKey(c) === key || calcKey(CALCULATION_LABELS[c]) === key,
  );
  if (!found)
    throw invalid(
      `The calculated field "${field}" needs a calculation: ${orList(CALCULATIONS.map((c) => `${c} (${CALCULATION_LABELS[c]})`))}.`,
    );
  return found;
}

// `true`, for a field that can be required; a checkbox (unticked reads as empty) and a calculated field (the plan
// works it out) are refused.
function requirable(field: Pick<CustomFieldDef, 'kind' | 'label' | 'timeSpent'>): true {
  if (isTimeSpent(field))
    throw invalid(
      `"${field.label}" tracks time: its entries are recorded, so it can't be required.`,
    );
  if (!canBeRequired(field.kind))
    throw invalid(
      field.kind === 'checkbox'
        ? `"${field.label}" is a checkbox: a checkbox can't be required.`
        : `"${field.label}" is calculated: the plan works it out, so it can't be required.`,
    );
  return true;
}

// `true`, for a Person field: no other kind names someone to tell.
function notifiable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (field.kind !== 'person')
    throw invalid(
      `"${field.label}" is ${withArticle(field.kind)} field: only a person field notifies.`,
    );
  return true;
}

// `true`, for a Person, Card or Image field: no other kind holds several people, cards or pictures (an Image field
// holding several is a Several Images field, docs/specs/026-plan/item-types.md "Image fields").
function severalable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (!holdsSeveralKind(field.kind) && field.kind !== 'image')
    throw invalid(
      `"${field.label}" is ${withArticle(field.kind)} field: only a person, card or image field holds several.`,
    );
  return true;
}

// Blocks (item-types.md "Blocked By"): only a Card field's cards block the card.
function blockable(field: Pick<CustomFieldDef, 'kind' | 'label'>): true {
  if (field.kind !== 'card')
    throw invalid(
      `"${field.label}" is ${withArticle(field.kind)} field: only a card field blocks.`,
    );
  return true;
}
